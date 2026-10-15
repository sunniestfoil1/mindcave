// Motion Blur estilo Lunar/Badlion Client para o Minecraft 1.8.9:
// Acumulação suave de quadros do buffer de renderização com persistência controlada por intensidade (1 a 10).
import * as THREE from 'three';

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = `
uniform sampler2D tCurrent;
uniform sampler2D tPrevious;
uniform float uBlend; // 0.0 (sem blur) a 0.85 (blur intenso)
uniform int uFirstFrame;
varying vec2 vUv;

void main() {
  vec4 curr = texture2D(tCurrent, vUv);
  if (uFirstFrame == 1) {
    gl_FragColor = curr;
    return;
  }
  vec4 prev = texture2D(tPrevious, vUv);
  gl_FragColor = mix(curr, prev, uBlend);
}
`;

export function createMotionBlur(renderer) {
  let width = 0;
  let height = 0;
  let pixelRatio = 1;

  let rtA = null;
  let rtB = null;
  let isTargetA = true;
  let firstFrame = true;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      tCurrent: { value: null },
      tPrevious: { value: null },
      uBlend: { value: 0.5 },
      uFirstFrame: { value: 1 },
    },
    depthTest: false,
    depthWrite: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  function resize(w, h, pr) {
    if (w === width && h === height && pr === pixelRatio && rtA) return;
    width = w;
    height = h;
    pixelRatio = pr;

    const rw = Math.max(1, Math.floor(w * pr));
    const rh = Math.max(1, Math.floor(h * pr));

    rtA?.dispose();
    rtB?.dispose();

    const options = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      stencilBuffer: false,
      depthBuffer: true,
    };

    rtA = new THREE.WebGLRenderTarget(rw, rh, options);
    rtB = new THREE.WebGLRenderTarget(rw, rh, options);
    firstFrame = true;
  }

  return {
    renderWithBlur(renderSceneFn, amount, w, h, pr) {
      if (amount <= 0) {
        // Sem blur: render direto no canvas
        renderer.setRenderTarget(null);
        renderSceneFn();
        firstFrame = true;
        return;
      }

      resize(w, h, pr);

      const blend = Math.min(0.85, 0.25 + (amount / 10) * 0.55);

      const writeTarget = isTargetA ? rtA : rtB;
      const readTarget = isTargetA ? rtB : rtA;

      // 1. Renderiza o mundo para o renderTarget atual
      renderer.setRenderTarget(writeTarget);
      renderer.clear();
      renderSceneFn();

      // 2. Acumula com o quadro anterior e joga na tela (canvas)
      material.uniforms.tCurrent.value = writeTarget.texture;
      material.uniforms.tPrevious.value = readTarget.texture;
      material.uniforms.uBlend.value = blend;
      material.uniforms.uFirstFrame.value = firstFrame ? 1 : 0;

      renderer.setRenderTarget(null);
      renderer.render(scene, camera);

      isTargetA = !isTargetA;
      firstFrame = false;
    },

    reset() {
      firstFrame = true;
    },

    dispose() {
      rtA?.dispose();
      rtB?.dispose();
      quad.geometry.dispose();
      material.dispose();
    },
  };
}
