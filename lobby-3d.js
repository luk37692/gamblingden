/**
 * 3D Lobby Background using Three.js
 */
(function () {
  'use strict';

  const container = document.querySelector('.hero-particles');
  if (!container) return;

  // Clear existing content (CSS particles)
  container.innerHTML = '';

  // Scene Setup
  const scene = new THREE.Scene();
  // Add some fog for depth
  scene.fog = new THREE.FogExp2(0x111111, 0.05);

  const camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 15;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0xffffff, 0.8);
  pointLight.position.set(10, 10, 10);
  scene.add(pointLight);

  // Objects
  const objects = [];
  const geometries = [
    new THREE.BoxGeometry(1.5, 1.5, 1.5), // Cube (Die)
    new THREE.CylinderGeometry(1, 1, 0.2, 32), // Cylinder (Chip)
    new THREE.IcosahedronGeometry(1) // Gem
  ];

  const colors = [0xff4444, 0x4444ff, 0x44ff44, 0xffd700];

  function createObject() {
    const geometry = geometries[Math.floor(Math.random() * geometries.length)];
    const material = new THREE.MeshPhongMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      shininess: 60,
      flatShading: true
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.x = (Math.random() - 0.5) * 40;
    mesh.position.y = (Math.random() - 0.5) * 20;
    mesh.position.z = (Math.random() - 0.5) * 20;
    
    mesh.rotation.x = Math.random() * Math.PI;
    mesh.rotation.y = Math.random() * Math.PI;

    // Custom rotation speed
    mesh.userData = {
        rotX: (Math.random() - 0.5) * 0.02,
        rotY: (Math.random() - 0.5) * 0.02,
        velY: (Math.random() - 0.5) * 0.01
    };

    scene.add(mesh);
    objects.push(mesh);
  }

  // Create initial objects
  for (let i = 0; i < 25; i++) {
    createObject();
  }

  // Mouse Interaction
  let mouseX = 0;
  let mouseY = 0;
  
  document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  // Animation Loop
  function animate() {
    requestAnimationFrame(animate);

    // Camera sway based on mouse
    camera.position.x += (mouseX * 5 - camera.position.x) * 0.05;
    camera.position.y += (mouseY * 5 - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    // Animate objects
    objects.forEach(obj => {
        obj.rotation.x += obj.userData.rotX;
        obj.rotation.y += obj.userData.rotY;
        obj.position.y += obj.userData.velY;

        // Floating boundary check
        if (Math.abs(obj.position.y) > 10) {
            obj.userData.velY *= -1;
        }
    });

    renderer.render(scene, camera);
  }

  animate();

  // Handle Resize
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

})();
