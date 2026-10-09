import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function colorForMaterial(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("diamond")) return 0x5defe5;
  if (n.includes("gold")) return 0xfcd93b;
  if (n.includes("iron") || n.includes("chain")) return 0xd8d8d8;
  if (n.includes("leather")) return 0x8b5a2b;
  if (n.includes("blade")) return 0xb0b0b0;
  if (n.includes("arrow")) return 0xc8a878;
  if (n.includes("particle") || n.includes("enchant")) return 0x9b6bff;
  if (n.includes("disc")) return 0x222222;
  if (n.includes("potion")) return 0x8b2bd9;
  if (n.includes("terrain") || n.includes("block")) return 0x88aa66;
  if (n.includes("palette")) return 0xcc8844;
  if (n.includes("item")) return 0xdddddd;
  return 0xcccccc;
}

export default function ModelScene({ url, visibleNodeName, colorize, wireTextures, onItems, autoRotate = true }) {
  const mountRef = useRef(null);
  const applyVisRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Scene setup (per url)
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer, scene, camera, controls, animationId;

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 420;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(3, 2, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 10, 7);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
    fill.position.set(-5, 3, -5);
    scene.add(fill);
    scene.add(new THREE.GridHelper(20, 20, 0x444466, 0x2a2a44));

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.2;

    function applyVisibility(name) {
      const root = applyVisRef.current?._root;
      if (!root) return;
      root.children.forEach((child) => {
        child.visible = name ? child.name === name : true;
      });
      const target = name ? root.children.find((c) => c.name === name) : root;
      if (target) {
        const box = new THREE.Box3().setFromObject(target);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const fitDist = (maxDim / (2 * Math.tan((camera.fov * Math.PI) / 180 / 2))) * 1.8;
        controls.target.copy(center);
        camera.position.set(center.x + fitDist * 0.6, center.y + fitDist * 0.4, center.z + fitDist);
        controls.update();
      }
    }

    const loader = new GLTFLoader();
    loader.load(
      url,
      async (gltf) => {
        const model = gltf.scene;
        const parser = gltf.parser;
        const json = parser.json;

        // Wire diffuse textures from KHR_materials_pbrSpecularGlossiness (three.js doesn't apply
        // this extension natively in current versions, so textures were missing).
        if (wireTextures && json.materials) {
          await Promise.all(
            json.materials.map(async (mdef, i) => {
              const ext = mdef.extensions && mdef.extensions.KHR_materials_pbrSpecularGlossiness;
              if (!ext || !ext.diffuseTexture) return;
              try {
                const mat = await parser.getDependency("material", i);
                const tex = await parser.getDependency("texture", ext.diffuseTexture.index);
                if (mat && tex) {
                  mat.map = tex;
                  mat.color = new THREE.Color(0xffffff);
                  mat.needsUpdate = true;
                }
              } catch (e) {
                /* skip material */
              }
            })
          );
        }

        if (colorize) {
          model.traverse((obj) => {
            if (obj.isMesh && obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach((mat) => {
                if (!mat.map && (mat.isMeshStandardMaterial || mat.isMeshBasicMaterial)) {
                  mat.color = new THREE.Color(colorForMaterial(mat.name));
                }
              });
            }
          });
        }

        // Descend single-child wrappers until we reach the node with the item children
        let itemRoot = model;
        while (itemRoot.children.length === 1) {
          itemRoot = itemRoot.children[0];
        }

        applyVisRef.current = { _root: itemRoot, apply: applyVisibility };

        scene.add(model);
        applyVisibility(visibleNodeName || null);

        if (onItems) onItems(itemRoot.children.filter((c) => c.name).map((c) => c.name));
        setLoading(false);
      },
      undefined,
      (err) => {
        console.error(err);
        setError("Não foi possível carregar o modelo 3D.");
        setLoading(false);
      }
    );

    const clock = new THREE.Clock();
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      controls.update(delta);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const ms = Array.isArray(obj.material) ? obj.material : [obj.material];
          ms.forEach((m) => m.dispose());
        }
      });
      applyVisRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Visibility toggle (when selection changes)
  useEffect(() => {
    const ref = applyVisRef.current;
    if (ref && ref.apply) ref.apply(visibleNodeName);
  }, [visibleNodeName]);

  return (
    <div className="relative w-full h-[420px] rounded-lg overflow-hidden border border-border bg-[#1a1a2e]">
      <div ref={mountRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            Carregando modelo 3D...
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm px-4 text-center">
          {error}
        </div>
      )}
    </div>
  );
}