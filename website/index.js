---
// ThreeViewer.astro - A Three.js viewer component for Astro
---
<div class="viewer-container">
  <canvas class="webgl"></canvas>
  <div class="overlay" id="speakerOverlay">
    <div class="overlay-content">
      <button class="close-button">&times;</button>
      <h2>Speaker Details</h2>
      <div class="speaker-info">
        <h3>Model: Studio Monitor</h3>
        <p>Professional studio monitor speaker with advanced acoustic design.</p>
        <div class="specs">
          <div class="spec-item">
            <strong>Frequency Response:</strong> 35Hz - 20kHz
          </div>
          <div class="spec-item">
            <strong>Power Output:</strong> 150W
          </div>
          <div class="spec-item">
            <strong>Drivers:</strong> 8" Woofer, 1" Tweeter
          </div>
        </div>
        <button class="action-button">More Details</button>
      </div>
    </div>
  </div>
</div>

<style>
  .viewer-container {
    width: 100%;
    height: 100vh;
    margin: 0;
    padding: 0;
    position: relative;
  }
  .webgl {
    width: 100%;
    height: 100%;
  }
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .overlay.visible {
    display: flex;
    opacity: 1;
  }
  .overlay-content {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    max-width: 500px;
    width: 90%;
    position: relative;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transform: translateY(20px);
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
  }
  .overlay.visible .overlay-content {
    transform: translateY(0);
    opacity: 1;
  }
  .close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    border: none;
    background: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.5rem;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.3s;
  }
  .close-button:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
  .speaker-info {
    margin-top: 1rem;
  }
  .specs {
    margin: 1.5rem 0;
  }
  .spec-item {
    margin: 0.5rem 0;
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 4px;
    transition: background-color 0.3s;
  }
  .spec-item:hover {
    background: #e9ecef;
  }
  .action-button {
    background: #007bff;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s;
    width: 100%;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .action-button:hover {
    background: #0056b3;
  }
  h2 {
    margin: 0;
    color: #333;
    font-size: 1.8rem;
  }
  h3 {
    color: #666;
    margin: 1rem 0;
    font-size: 1.4rem;
  }
  p {
    color: #555;
    line-height: 1.6;
    margin-bottom: 1rem;
  }
</style>

<script>
//=============================================================================
// Type Declarations and Imports
//=============================================================================
interface Intersection {
    distance: number;
    point: THREE.Vector3;
    face: THREE.Face | null;
    faceIndex: number | null;
    instanceId?: number;
    object: THREE.Object3D;
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

//=============================================================================
// Scene Setup
//=============================================================================
// Canvas
const canvas = document.querySelector('canvas.webgl');
if (!canvas) throw new Error('Canvas not found');

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8c8c8c);

// Sizes
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

// Camera
const camera = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1, 5000);
camera.position.set(0, 50, 1500);
camera.lookAt(0, 0, 0);
scene.add(camera);

// Create camera target for consistent orientation
const cameraTarget = new THREE.Vector3(0, 50, 0);
const cameraPitchDeg = -20;
const cameraPitchRad = THREE.MathUtils.degToRad(cameraPitchDeg);

// Renderer
const renderer = new THREE.WebGLRenderer({
    canvas: canvas as HTMLCanvasElement,
    antialias: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.shadowMap.enabled = true;
(renderer as any).physicallyCorrectLights = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
scene.background = new THREE.Color(0x8c8c8c);n

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const spotLight = new THREE.SpotLight(0xffffff, 3);
spotLight.castShadow = true;
spotLight.position.set(camera.position.x + 50, camera.position.y + 50, camera.position.z);
spotLight.target.position.set(0, 0, 0);
scene.add(spotLight);
scene.add(spotLight.target);

// Configure shadow properties
spotLight.shadow.mapSize.width = 2048;
spotLight.shadow.mapSize.height = 2048;
spotLight.shadow.camera.near = 1;
spotLight.shadow.camera.far = 2000;

//=============================================================================
// State Management
//=============================================================================
// Interaction state
const panSpeed = 0.5; // world units per pixel
const panDamping = 6.0; // damping rate per second
const dragThreshold = 4; // pixels
const clock = new THREE.Clock();

// State variables
let isPanning = false;
let lastPanX = 0;
let isDragging = false;
let totalDragMovement = 0;
let panVelocity = 0;

// Selection state
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const instancedMeshes: THREE.InstancedMesh[] = [];
let selectedMesh: THREE.InstancedMesh | null = null;
let selectedInstance = -1;

//=============================================================================
// Overlay Management
//=============================================================================
function showOverlay() {
    const overlay = document.getElementById('speakerOverlay');
    if (overlay) {
        overlay.classList.add('visible');
    }
}

function hideOverlay() {
    const overlay = document.getElementById('speakerOverlay');
    if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => {
            if (!overlay.classList.contains('visible')) {
                if (selectedMesh && selectedInstance !== -1) {
                    const matrix = new THREE.Matrix4();
                    selectedMesh.getMatrixAt(selectedInstance, matrix);
                    const position = new THREE.Vector3();
                    const quaternion = new THREE.Quaternion();
                    const scale = new THREE.Vector3();
                    matrix.decompose(position, quaternion, scale);
                    position.z -= 80;
                    matrix.compose(position, quaternion, scale);
                    selectedMesh.setMatrixAt(selectedInstance, matrix);
                    selectedMesh.instanceMatrix.needsUpdate = true;
                    selectedMesh = null;
                    selectedInstance = -1;
                }
            }
        }, 300);
    }
}

//=============================================================================
// Selection Handler
//=============================================================================
function handleSelection(event: MouseEvent) {
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    // Find closest intersection
    let closestIntersection: Intersection | null = null;
    let minDistance = Infinity;

    for (const meshItem of instancedMeshes) {
        const intersects = raycaster.intersectObject(meshItem) as Intersection[];
        if (intersects.length > 0 && intersects[0].distance < minDistance) {
            closestIntersection = intersects[0];
            minDistance = intersects[0].distance;
        }
    }

    if (!closestIntersection) return;

    const hitInstanceId = closestIntersection.instanceId;
    if (hitInstanceId === undefined) return;

    const hitMesh = closestIntersection.object as THREE.InstancedMesh;
    console.log('Click detected on instance:', hitInstanceId);

    if (selectedMesh === hitMesh && selectedInstance === hitInstanceId) {
        hideOverlay();
        return;
    }

    if (selectedMesh && selectedInstance !== -1) {
        const prevMatrix = new THREE.Matrix4();
        selectedMesh.getMatrixAt(selectedInstance, prevMatrix);
        const prevPosition = new THREE.Vector3();
        const prevQuaternion = new THREE.Quaternion();
        const prevScale = new THREE.Vector3();
        prevMatrix.decompose(prevPosition, prevQuaternion, prevScale);
        prevPosition.z -= 80;
        prevMatrix.compose(prevPosition, prevQuaternion, prevScale);
        selectedMesh.setMatrixAt(selectedInstance, prevMatrix);
        selectedMesh.instanceMatrix.needsUpdate = true;
    }

    const newMatrix = new THREE.Matrix4();
    hitMesh.getMatrixAt(hitInstanceId, newMatrix);
    const newPosition = new THREE.Vector3();
    const newQuaternion = new THREE.Quaternion();
    const newScale = new THREE.Vector3();
    newMatrix.decompose(newPosition, newQuaternion, newScale);
    newPosition.z += 80;
    newMatrix.compose(newPosition, newQuaternion, newScale);
    hitMesh.setMatrixAt(hitInstanceId, newMatrix);
    hitMesh.instanceMatrix.needsUpdate = true;

    selectedMesh = hitMesh;
    selectedInstance = hitInstanceId;
    showOverlay();
}

//=============================================================================
// Event Handlers
//=============================================================================
// Overlay controls
if (typeof document !== 'undefined') {
    const closeButton = document.querySelector('.close-button');
    const overlay = document.getElementById('speakerOverlay');
    const actionButton = document.querySelector('.action-button');

    if (closeButton) {
        closeButton.addEventListener('click', () => {
            hideOverlay();
        });
    }

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                hideOverlay();
            }
        });
    }

    if (actionButton) {
        actionButton.addEventListener('click', () => {
            console.log('More details clicked for speaker:', selectedInstance);
            // Add your action here
        });
    }
}

// Window resize
window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Mouse events
canvas.addEventListener('mousedown', ((event: Event) => {
    const mouseEvent = event as MouseEvent;
    if (mouseEvent.button === 0) {
        isDragging = true;
        totalDragMovement = 0;
        lastPanX = mouseEvent.clientX;
    }
}) as EventListener);

window.addEventListener('mousemove', ((event: Event) => {
    const mouseEvent = event as MouseEvent;
    if (isDragging) {
        const deltaX = mouseEvent.clientX - lastPanX;
        totalDragMovement += Math.abs(deltaX);

        if (totalDragMovement > dragThreshold) {
            isPanning = true;
            panVelocity = deltaX * panSpeed;
        }

        lastPanX = mouseEvent.clientX;
    }
}) as EventListener);

window.addEventListener('mouseup', ((event: Event) => {
    const mouseEvent = event as MouseEvent;
    if (mouseEvent.button === 0) {
        if (!isPanning && isDragging) {
            handleSelection(mouseEvent);
        }
        isDragging = false;
        isPanning = false;
    }
}) as EventListener);

//=============================================================================
// Model Loading
//=============================================================================
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// Load the speaker model
gltfLoader.load('/speaker.glb',
    (gltf) => {
        const model = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.sub(center);
        model.position.y = 50;
        model.scale.set(1, 1, 1);

        // Set up shadow casting for all meshes
        model.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
                (child as THREE.Mesh).castShadow = true;
                (child as THREE.Mesh).receiveShadow = true;
                
                if ((child as THREE.Mesh).material) {
                    if (Array.isArray((child as THREE.Mesh).material)) {
                        ((child as THREE.Mesh).material as THREE.Material[]).forEach(mat => {
                            mat.needsUpdate = true;
                        });
                    } else {
                        (child as THREE.Mesh).material.needsUpdate = true;
                    }
                }
            }
        });

        model.receiveShadow = true;

        // Create InstancedMeshes: speakers side-by-side
        const instances = 6;
        const spacing = 270; // distance between speaker centers on X axis

        // For each mesh inside the loaded model, create an InstancedMesh
        model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
                // Ensure material is not an array
                let mat = (child as THREE.Mesh).material;
                if (Array.isArray(mat)) {
                    mat = mat[0];
                }

                // Clone geometry and material
                const geom = (child as THREE.Mesh).geometry.clone();
                const material = mat.clone ? mat.clone() : mat;

                const inst = new THREE.InstancedMesh(geom, material, instances);
                inst.castShadow = true;
                inst.receiveShadow = true;

                const dummy = new THREE.Object3D();

                for (let i = 0; i < instances; i++) {
                    // Position each instance along X
                    dummy.position.set((i - (instances - 1) / 2) * spacing, child.position.y + 50, child.position.z);
                    dummy.rotation.copy(child.rotation);
                    dummy.scale.copy(child.scale);
                    dummy.updateMatrix();
                    inst.setMatrixAt(i, dummy.matrix);
                }

                inst.instanceMatrix.needsUpdate = true;
                scene.add(inst);

                // Track instanced mesh for interaction
                instancedMeshes.push(inst);
            }
        });

        console.log("Added instanced speaker(s)");
    },
    undefined,
    function (error: any) {
        console.error("Load Error GLB", error);
    }
);

//=============================================================================
// Animation Loop
//=============================================================================
function animate() {
    const deltaTime = clock.getDelta();

    if (!isPanning) {
        panVelocity *= Math.exp(-panDamping * deltaTime);
    }

    camera.position.x += panVelocity * deltaTime;
    
    // Update camera target position and orientation
    cameraTarget.x = camera.position.x;
    const pitchedDir = new THREE.Vector3(0, Math.sin(cameraPitchRad), -Math.cos(cameraPitchRad));
    const lookDistance = 100;
    cameraTarget.copy(camera.position).addScaledVector(pitchedDir, lookDistance);
    camera.lookAt(cameraTarget);

    // Update light position relative to camera
    const lightOffset = new THREE.Vector3(50, 50, 0);
    spotLight.position.copy(camera.position).add(lightOffset);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// Start animation after everything is set up
animate();
</script>