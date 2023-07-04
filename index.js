// start loading the shaders before the blocking imports
const vertexShaderPromise = fetch('/position.vert').then(response => response.text());
const fragmentShaderPromise = fetch('/mandelbulb.frag').then(response => response.text());

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const fractalElement = document.querySelector('.fractal');
const renderer = new THREE.WebGLRenderer({ antialias: true });
fractalElement.append(renderer.domElement);

const scene = new THREE.Scene();
const mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2.0, 2.0), null);
scene.add(mesh);

const frameCamera = new THREE.Camera();

const camera = new THREE.PerspectiveCamera(75, 1, 0.01, 1000);
camera.position.set(0.0, 0.0, 3.0);
camera.rotation.set(0.0, 0.0, 0.0);
// autoRotate in x & y
camera.up.set( -1, 1, 0 );

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.autoRotate = true;

const clock = new THREE.Clock()

function resize() {
    const { width, height } = fractalElement.getBoundingClientRect();

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
}
resize();
window.addEventListener('resize', resize);


async function createShader() {
    const [vertexShader, fragmentShader] = [await vertexShaderPromise, await fragmentShaderPromise];
    const shader = new THREE.RawShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            screenRes: {},
            randSeed: {},
            cameraPos: { value: new THREE.Vector3() },
            cameraDir: { value: new THREE.Vector3() },
            cameraRight: { value: new THREE.Vector3() },
            cameraSpeed: { value: 1.0 },
            framesCount: { value: 1.0 },
            bokeh: { type: "float", value: 0.05 }, 
            cameraFocus: { type: "float", value: 1.9 }, 
            cameraZoom: { type: "float", value: 6.5 }, 
            hueScale: { type: "float", value: 1.9 }, 
            saturation: { type: "float", value: 0.7 }, 
            colorValue: { type: "float", value: 0.7 }, 
            exponent: { type: "float", value: 6 },
            maxSteps: { type: "int", value: 40 },
        },
    });
    mesh.material = shader;
    
    const Y_VECTOR = new THREE.Vector3(0, 1, 0);

    const exponentAnimation = {
        field: 'exponent',
        direction: 0.01,
        max: 10,
        min: 2,
    };

    const colorAnimation = {
        field: 'colorValue',
        direction: -.001,
        max: 0.9,
        min: 0.4,
    };

    function animateValue(animation, timeDelta) {
        let value = shader.uniforms[animation.field].value;
        value += animation.direction * timeDelta;

        if (value >= animation.max || value <= animation.min) {
            animation.direction = -animation.direction;
        }
        shader.uniforms[animation.field].value = value;
    }

    function sendCameraToShader() {
        const cameraPos = shader.uniforms.cameraPos.value;
        const cameraDir = shader.uniforms.cameraDir.value;
        const cameraRight = shader.uniforms.cameraRight.value;
        // copies the vectors into the shader
        camera.getWorldPosition(cameraPos);
        camera.getWorldDirection(cameraDir);
        cameraRight.copy(cameraDir).cross(Y_VECTOR).normalize();
    }

    let framesHit = 0;

    function animate() {
        orbit.update();
        // shooting for 30 fps
        let timeDelta = clock.getDelta() * 30;
        animateValue(exponentAnimation, timeDelta);
        animateValue(colorAnimation, timeDelta);
        sendCameraToShader();

        if (timeDelta >  0.95) {
            framesHit++;
        } else {
            framesHit = 0;
        }

        if (framesHit >= 10 && shader.uniforms.maxSteps.value < 80) {
            shader.uniforms.maxSteps.value += 5;
            // at least two frames at the next cadence before increasing steps
            framesHit = 8;
        }
        const { width, height } = fractalElement.getBoundingClientRect();
        shader.uniforms.screenRes.value = new THREE.Vector2(width, height);
        shader.uniforms.randSeed.value = new THREE.Vector2(THREE.Math.randFloat(0.0, 1.0), THREE.Math.randFloat(0.0, 1.0));
        
        renderer.render(scene, frameCamera);
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}
createShader();