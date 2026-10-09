// Visualizador 3D do Studio — estende ModelScene com modos de inspeção — PRD 10 RF-020..024
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const DISPLAY_MODES = {
  shaded: 'Sombreado',
  albedo: 'Albedo',
  wireframe: 'Wireframe',
  normals: 'Normais',
  skeleton: 'Esqueleto',
  boundingbox: 'Caixa delimitadora',
};

const LIGHT_PRESETS = {
  studio: 'Estúdio',
  day: 'Dia no jogo',
  night: 'Noite',
  cave: 'Caverna c/ tocha',
};

export default function StudioViewer({ url, displayMode = 'shaded', lightPreset = 'studio', showGrid = true, showAxes = true, autoRotate = false, onMetadata }) {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const stateRef = useRef({});

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 1000);
    camera.position.set(3, 2.5, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Luzes
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(5, 10, 7);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.3);
    fill.position.set(-5, 3, -5);
    scene.add(fill);

    // Grade do chão em blocos (1 célula = 1 bloco, subdivisão 16)
    if (showGrid) {
      const grid = new THREE.GridHelper(4, 4 * 16, 0x444466, 0x2a2a44);
      grid.position.y = 0;
      scene.add(grid);
    }
    if (showAxes) {
      const axes = new THREE.AxesHelper(1.5);
      scene.add(axes);
    }

    // Silhueta de referência: bloco 1×1×1
    const refBlock = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0x4a8aff, transparent: true, opacity: 0.4 })
    );
    refBlock.position.y = 0.5;
    refBlock.visible = false;
    scene.add(refBlock);

    // Silhueta de referência: jogador 0.6×1.8
    const refPlayer = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.6, 1.8, 0.6)),
      new THREE.LineBasicMaterial({ color: 0x44dd44, transparent: true, opacity: 0.4 })
    );
    refPlayer.position.y = 0.9;
    refPlayer.visible = false;
    scene.add(refPlayer);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.0;

    stateRef.current = { scene, camera, renderer, controls, ambient, dir, fill, refBlock, refPlayer };

    // Carregar GLB
    let model = null;
    let skeletonHelper = null;
    let bboxHelper = null;

    if (url) {
      setLoading(true);
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        model = gltf.scene;

        // Apoiar base no chão (RF-022)
        const box = new THREE.Box3().setFromObject(model);
        const minY = box.min.y;
        model.position.y -= minY;

        // Detectar escala (se a caixa sugerir 16× ou 100×, oferecer correção)
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        let autoScale = 1;
        if (maxDim > 10 && maxDim < 50) autoScale = 1 / 16; // escala de blocos
        else if (maxDim > 50) autoScale = 1 / 100; // escala de metros
        if (autoScale !== 1) model.scale.setScalar(autoScale);

        scene.add(model);

        // Esqueleto
        if (displayMode === 'skeleton') {
          skeletonHelper = new THREE.SkeletonHelper(model);
          skeletonHelper.visible = true;
          scene.add(skeletonHelper);
        }

        // Caixa delimitadora
        if (displayMode === 'boundingbox') {
          const adjustedBox = new THREE.Box3().setFromObject(model);
          bboxHelper = new THREE.Box3Helper(adjustedBox, 0xffff00);
          scene.add(bboxHelper);
        }

        // Wireframe
        if (displayMode === 'wireframe') {
          model.traverse((obj) => {
            if (obj.isMesh) {
              obj.material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
            }
          });
        }
        // Normais
        if (displayMode === 'normals') {
          model.traverse((obj) => {
            if (obj.isMesh) {
              obj.material = new THREE.MeshNormalMaterial();
            }
          });
        }
        // Albedo (sem iluminação)
        if (displayMode === 'albedo') {
          model.traverse((obj) => {
            if (obj.isMesh) {
              const oldMat = obj.material;
              obj.material = new THREE.MeshBasicMaterial({ map: oldMat.map, color: oldMat.color || 0xffffff });
            }
          });
        }

        // Enquadrar
        const finalBox = new THREE.Box3().setFromObject(model);
        const finalSize = finalBox.getSize(new THREE.Vector3());
        const finalCenter = finalBox.getCenter(new THREE.Vector3());
        const fitDist = (Math.max(finalSize.x, finalSize.y, finalSize.z) || 1) * 2.5;
        controls.target.copy(finalCenter);
        camera.position.set(finalCenter.x + fitDist * 0.6, finalCenter.y + fitDist * 0.4, finalCenter.z + fitDist);
        controls.update();

        setLoading(false);

        // Callback com metadados resumidos
        if (onMetadata) {
          let tris = 0, verts = 0;
          model.traverse((obj) => {
            if (obj.isMesh && obj.geometry) {
              if (obj.geometry.index) tris += obj.geometry.index.count / 3;
              else if (obj.geometry.attributes.position) tris += obj.geometry.attributes.position.count / 3;
              if (obj.geometry.attributes.position) verts += obj.geometry.attributes.position.count;
            }
          });
          onMetadata({ triangles: Math.round(tris), vertices: verts, size: { x: finalSize.x, y: finalSize.y, z: finalSize.z }, clips: gltf.animations?.map(a => ({ name: a.name, duration: a.duration })) || [] });
        }
      }, undefined, (err) => {
        console.error(err);
        setError("Não foi possível carregar o modelo.");
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    const clock = new THREE.Clock();
    let animationId;
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
      const h = mount.clientHeight || 500;
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
          ms.forEach(m => m.dispose());
        }
      });
    };
  }, [url]);

  // Atualizar luzes quando preset muda
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    if (lightPreset === 'studio') { s.ambient.intensity = 0.6; s.dir.intensity = 1.0; s.fill.intensity = 0.3; }
    else if (lightPreset === 'day') { s.ambient.intensity = 0.8; s.dir.intensity = 1.2; s.fill.intensity = 0.5; }
    else if (lightPreset === 'night') { s.ambient.intensity = 0.2; s.dir.intensity = 0.3; s.fill.intensity = 0.1; }
    else if (lightPreset === 'cave') { s.ambient.intensity = 0.15; s.dir.intensity = 0.2; s.fill.intensity = 0.05; }
  }, [lightPreset]);

  // Mostrar/ocultar referências
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    // toggle handled externally — could expose via props
  }, []);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-[#1a1a2e]">
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
        <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm px-4 text-center">{error}</div>
      )}
    </div>
  );
}