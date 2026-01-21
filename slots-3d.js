/**
 * 3D Slots Implementation
 * Handles the Three.js scene, reel creation, and spin animations.
 * Exposed globally as `Slots3D` for the main logic to control.
 */
const Slots3D = (function () {
  'use strict';

  let scene, camera, renderer;
  let reels = []; // Array of Mesh objects
  let symbolTexture; // The atlas texture
  const SYMBOL_COUNT = 6;
  const REEL_RADIUS = 3; 
  const SEGMENTS = 32;
  // Calculate angle per symbol: 6 symbols repeated X times around the cylinder?
  // Let's simpler: Cylinder has enough height or circumference to hold many symbols.
  // Actually, standard 3D slots often model strict strips.
  // We'll map the texture such that it repeats vertically.
  // If we have 6 symbols, let's say the cylinder circumference holds exactly 12 symbols (2 sets).
  const SYMBOLS_ON_REEL = 12; 
  const ANGLE_PER_SYMBOL = (Math.PI * 2) / SYMBOLS_ON_REEL;

  // Configuration from main logic (to be sync)
  const SYMBOLS_MAP = ["CHERRY", "LEMON", "BELL", "SEVEN", "WILD", "SCATTER"];
  
  function init(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error('Slots3D: Canvas not found:', canvasId);
      return;
    }

    const container = canvas.parentElement;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 300;

    console.log('Slots3D init:', width, 'x', height);

    // SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1018);

    // CAMERA - closer and wider FOV to see the reels
    const aspect = width / height;
    camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    camera.position.z = 12;
    camera.position.y = 0; 

    // RENDERER - use existing canvas
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    } catch(e) {
      console.error('WebGL failed:', e);
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 10);
    scene.add(dirLight);

    const spotLight = new THREE.SpotLight(0x6366f1, 0.5); // --accent-primary
    spotLight.position.set(0, 10, 0);
    scene.add(spotLight);

    // TEXTURES
    symbolTexture = createSymbolAtlas();

    // REELS
    createReels();

    // Loop
    animate();

    // Trigger initial render
    renderer.render(scene, camera);

    // Resize
    window.addEventListener('resize', () => {
        const w = container.clientWidth || 600;
        const h = container.clientHeight || 300;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
    });

    console.log('Slots3D: Initialized successfully');
  }

  function createSymbolAtlas() {
    const size = 512; // Each symbol is 512x512
    const canvas = document.createElement('canvas');
    canvas.width = size * SYMBOL_COUNT; // Horizontal strip
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const emojis = ["🍒", "🍋", "🔔", "7️⃣", "⭐", "💎"];

    emojis.forEach((emoji, i) => {
        const x = i * size;
        
        // Background panel
        const gradient = ctx.createLinearGradient(x, 0, x, size); // Vertical gradient per cell
        gradient.addColorStop(0, '#f1f5f9');
        gradient.addColorStop(0.5, '#ffffff');
        gradient.addColorStop(1, '#f1f5f9');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, 0, size, size);

        // Border line (Vertical lines between symbols)
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(x + size - 2, 0, 4, size);

        // Symbol
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${size * 0.6}px serif`; 
        ctx.fillStyle = "#000";
        ctx.fillText(emoji, x + size / 2, size / 2 + (size * 0.05)); 
    });

    const tex = new THREE.CanvasTexture(canvas);
    // Horizontal wrapping
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  function createReels() {
    // Cylinder with smaller radius for better visibility
    const geometry = new THREE.CylinderGeometry(2, 2, 2.5, SEGMENTS, 1, true);
    geometry.rotateZ(Math.PI / 2); 
    
    // Texture mapping
    symbolTexture.repeat.set(2, 1); 

    const material = new THREE.MeshStandardMaterial({ 
        map: symbolTexture,
        roughness: 0.3,
        metalness: 0.2,
        side: THREE.DoubleSide
    });

    for(let i=0; i<3; i++) {
        const reel = new THREE.Mesh(geometry, material.clone());
        reel.position.x = (i - 1) * 3.2; // -3.2, 0, 3.2
        scene.add(reel);
        reels.push(reel);
        
        // Initial rotation
        const randomSlot = Math.floor(Math.random() * SYMBOLS_ON_REEL);
        reel.rotation.x = randomSlot * ANGLE_PER_SYMBOL;
        
        reel.userData = { isSpinning: false };
    }
    console.log('Slots3D: Created', reels.length, 'reels');
  }

  // Animation Loop
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPOSED API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Spin the reels to a specific stop index
   * @param {number[]} stops - Array of 3 indices (0-based index of the symbol strip)
   * The logic in slots.js uses simple arrays for reels.
   * We need to map "Stop Index from Logic" -> "Visual Symbol".
   * 
   * Logic Reel: ["CHERRY", "BELL", ...] (Length ~20-30)
   * Visual Reel: Just 12 slots on the cylinder, repeating the 6 basic symbols.
   * 
   * This is a "fake" visual representation. 
   * When logic says "Stop at index 5 (which is BELL)", we must rotate the 3D reel 
   * so that a "BELL" section is facing forward.
   */
  async function spinTo(stops, logicalReels) {
     const promises = reels.map((reel, index) => {
        return new Promise(resolve => {
            const targetSymbolName = logicalReels[index][stops[index]]; // e.g., "BELL"
            const symbolIndex = SYMBOLS_MAP.indexOf(targetSymbolName);
            
            // Calculate target angle
            // We have 12 slots. Symbols are 0..5, 0..5.
            // Let's pick a random instance of that symbol on the wheel to land on (either first or second half)
            const instance = Math.random() < 0.5 ? 0 : 1;
            const targetSlot = symbolIndex + (instance * 6);
            
            // We spin FORWARD (positive X rotation).
            // Current angle
            const current = reel.rotation.x;
            
            // Angle to land exactly on targetSlot
            // UV 0 is at theta 0? Need to calibrate.
            // Usually need a detailed offset. Let's assume 0 is aligned.
            const slotAngle = targetSlot * ANGLE_PER_SYMBOL;
            
            // We want to do at least 2 full spins + delta
            const fullSpins = (Math.PI * 2) * (3 + index); // 3, 4, 5 spins staggered
            
            // Calculate destination: Next multiple of 2PI that aligns with slotAngle
            // Or just current + spins + diff.
            
            // The texture is rotated, mapping is tricky.
            // Let's trial and error the offset if needed.
            // Assuming standard UV mapping: 0 radians = start of texture.
            
            // Destination angle
            // We subtract because cylinder rolls "towards" player? 
            // Identifying "Front": usually Z+.
            // If we rotate X, the top moves back, bottom moves front. 
            // We want symbols to fly down (Top -> Bottom).
            // That means X rotation should be POSITIVE? (Right Hand Rule: Thumb X+, fingers curl Y->Z).
            // Yes, Positive X rotation makes top go back? No, wait.
            // Thumb right. Fingers curl Top(Y) -> Front(Z) -> Bottom(-Y) -> Back(-Z).
            // So +X makes top come Forward. That's "Symbols falling down". Correct.
            
            const destAngle = current + fullSpins + ((slotAngle - (current % (Math.PI * 2))) % (Math.PI * 2));
            // Actually, simplified:
            // Just add spins + offset to reach the specific symbol orientation.
            // Since we don't know exact offset, we might need a "offset correction" constant.
            // Let's Assume 0 is correct for now.
            
            // TWEEN replacement (simple animation loop)
            const duration = 2000 + (index * 500);
            const startTime = performance.now();
            const startAngle = reel.rotation.x;
            // Ensure we land on exact slot multiple relative to total rotation
            // We want final angle to satisfy: (final % 2PI) approx (slotAngle)
            // But since texture repeats, we just need to match the visual.
            
            // Let's use a simple heuristic:
            // Add arbitrary large rotations, then add the specific delta to reach target.
            const rounds = 5 + index * 2;
            const targetRotation = startAngle + (rounds * Math.PI * 2) + (slotAngle - (startAngle % (Math.PI * 2)));

            function animateReel(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Ease Out Cubic
                const ease = 1 - Math.pow(1 - progress, 3);
                
                reel.rotation.x = startAngle + (targetRotation - startAngle) * ease;
                
                if (progress < 1) {
                    requestAnimationFrame(animateReel);
                } else {
                    resolve();
                }
            }
            requestAnimationFrame(animateReel);
        });
     });

     await Promise.all(promises);
  }
  
  return {
    init,
    spinTo
  };

})();
