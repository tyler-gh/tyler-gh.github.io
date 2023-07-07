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
camera.up.set(-1, 1, 0);


async function createShader() {
    const [vertexShader, fragmentShader] = [await vertexShaderPromise, await fragmentShaderPromise];
    const shader = new THREE.RawShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            screenRes: { value: new THREE.Vector2() },
            randSeed: { value: new THREE.Vector2() },
            mousePos: { value: new THREE.Vector2() },
            cameraPos: { value: new THREE.Vector3() },
            cameraDir: { value: new THREE.Vector3() },
            cameraRight: { value: new THREE.Vector3() },
            cameraSpeed: { value: 1.0 },
            framesCount: { value: 1.0 },
            cameraFocus: { value: 1.9 },
            cameraZoom: { value: 6.5 },
            hueScale: { value: 1.9 },
            saturation: { value: 0.7 },
            colorValue: { value: 0.7 },
            exponent: { value: 6 },
        },
    });
    mesh.material = shader;

    const MAX_SCALE = 8;
    const MIN_SCALE = 1;

    const storedScale = Number(localStorage.getItem('canvasScaling') ?? NaN)
    let canvasScaling = Math.max(Math.min(isNaN(storedScale) ? MAX_SCALE : storedScale, MAX_SCALE), MIN_SCALE);

    function resize() {
        const { width, height } = fractalElement.getBoundingClientRect();

        const cameraWidth = width / canvasScaling;
        const cameraHeight = height / canvasScaling;

        const currentSize = new THREE.Vector2();
        renderer.getSize(currentSize);
        camera.aspect = cameraWidth / cameraHeight;
        camera.updateProjectionMatrix();
        shader.uniforms.screenRes.value.set(cameraWidth, cameraHeight);

        renderer.setSize(cameraWidth, cameraHeight);

        renderer.domElement.style.width = width;
        renderer.domElement.style.height = height;

        const currentMousePos = shader.uniforms.mousePos.value;
        shader.uniforms.mousePos.value.set(
            currentMousePos.x * (cameraWidth / currentSize.x),
            currentMousePos.y * (cameraHeight / currentSize.y),
        );
    }
    resize();
    window.addEventListener('resize', resize);

    function setupInteractivity(element) {
        const orbit = new OrbitControls(camera, element);
        orbit.autoRotate = true;
        orbit.enableKeys = false;
        orbit.enablePan = false;
        orbit.rotateSpeed = 0.25;
        element.addEventListener('pointerdown', (event) => {
            camera.up.set(0, 1, 0);
            orbit.autoRotate = false;
        });
        element.addEventListener('pointerup', (event) => {
            camera.up.set(-1, 1, 0);
            orbit.autoRotate = true;
        });
        element.addEventListener('mousemove', (event) => {
            const scaledX = event.clientX / canvasScaling;
            const scaledY = event.clientY / canvasScaling;
            shader.uniforms.mousePos.value.set(scaledX, renderer.domElement.height - scaledY);
        });
        return orbit;
    }
    const orbit = setupInteractivity(renderer.domElement);

    const Y_VECTOR = new THREE.Vector3(0, 1, 0);

    const exponentAnimation = {
        field: 'exponent',
        direction: 0.01,
        max: 10,
        min: 2,
    };

    const colorAnimation = {
        field: 'colorValue',
        direction: -0.001,
        max: 0.9,
        min: 0.4,
    };

    function animateValue(animation, timeDelta) {
        let value = shader.uniforms[animation.field].value;
        if (value >= animation.max) {
            animation.direction = -animation.direction;
            value = animation.max;
        } else if (value <= animation.min) {
            animation.direction = -animation.direction;
            value = animation.min;
        }
        shader.uniforms[animation.field].value = value + animation.direction * timeDelta;
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

    class AverageFPS {
        average = 1.0;
        lastMeasuredTime = 0;
        normalizedDelta = 0;
        frames = 0;

        update() {
            const time = performance.now();
            if (this.lastMeasuredTime === 0) {
                this.lastMeasuredTime = time;
                return;
            }
            const delta = (time - this.lastMeasuredTime) / 1000;
            this.lastMeasuredTime = time;
            this.average -= this.average / 30;
            this.average += delta;
            this.normalizedDelta = delta * 30;
            this.frames++;
        }
    }
    const clock = new AverageFPS();

    function render() {
        clock.update();
        orbit.update();
        animateValue(exponentAnimation, clock.normalizedDelta);
        animateValue(colorAnimation, clock.normalizedDelta);
        sendCameraToShader();
        shader.uniforms.randSeed.value.set(THREE.Math.randFloat(0.0, 1.0), THREE.Math.randFloat(0.0, 1.0));
        renderer.render(scene, frameCamera);
    }

    function getScaleDelta() {
        if (clock.average <= 1.01 && canvasScaling > MIN_SCALE) {
            return -0.1;
        } 
        if (clock.average > 1.1 && canvasScaling < MAX_SCALE) {
            return 0.1;
        }
        return 0;
    }

    let lastScaleFrame = 0;
    function scaleRenderSize() {
        if (clock.frames <= 10 || (clock.frames - lastScaleFrame) < 5) {
            return;
        }
        const scaleDelta = getScaleDelta();
        if (scaleDelta !== 0) {
            canvasScaling += scaleDelta
            lastScaleFrame = clock.frames;
            resize();
            localStorage.setItem('canvasScaling', `${canvasScaling}`);
        }
    }

    function animate() {
        scaleRenderSize();
        render();
        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}
createShader();