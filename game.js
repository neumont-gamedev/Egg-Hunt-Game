/**
 * EggHuntGame - A simple Phaser 3 game where players hunt for eggs in a scrollable world
 * The goal is to find the special golden egg among regular eggs
 */
class EggHuntGame extends Phaser.Scene {
  constructor() {
    super({ key: 'EggHuntGame' });

    // Grid and egg size configuration
    this.eggWidth = 100;
    this.eggHeight = 100;
    this.eggGridSizeWidth = 40;
    this.eggGridSizeHeight = 40;
    
    // Track the number of eggs collected during gameplay
    this.eggsCollected = 0;

    // Calculate total eggs and world dimensions
    this.numEggs = this.eggGridSizeWidth * this.eggGridSizeHeight;
    this.worldSizeWidth = this.eggGridSizeWidth * this.eggWidth;
    this.worldSizeHeight = this.eggGridSizeHeight * this.eggHeight;

    // Generate a random position for the winning egg, avoiding edges
    this.winningEggIndex = Math.floor(Math.random() * (this.numEggs - 40)) + 20;
  }

  /**
   * Preload game assets and setup loading UI
   */
  preload() {
    console.log("Preloading assets...");
    
    // Create loading progress UI elements
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(240, 270, 320, 50);

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      font: '20px Arial',
      fill: '#ffffff'
    });
    loadingText.setOrigin(0.5, 0.5);

    // Setup loading progress events
    this.load.on('progress', function (value) {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(250, 280, 300 * value, 30);
    });

    this.load.on('complete', function () {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Load the game's asset manifest (JSON file containing asset paths and info)
    this.load.json('game-manifest', 'game-manifest.json');

    // Log when preload is complete
    this.load.on('complete', () => {
      console.log("Initial preload complete");
      this.initialPreloadComplete = true;
    });
  }

  /**
   * Initialize sound objects from loaded audio files
   */
  initializeSounds() {
    console.log("Initializing sounds from keys:", this.audioKeys);
    this.sounds = {};

    // Create sound objects for each loaded audio key
    if (this.audioKeys && this.audioKeys.length > 0) {
      this.audioKeys.forEach(key => {
        try {
          this.sounds[key] = this.sound.add(key);
          console.log(`Sound ${key} initialized successfully`);
        } catch (error) {
          console.error(`Error initializing sound ${key}:`, error);
        }
      });
    }
  }

  /**
   * Load assets from the manifest file
   * @param {string} manifestName - The key of the JSON manifest
   */
  loadAssets(manifestName) {
    // Check if manifest exists in cache
    if (this.cache.json.has(manifestName)) {
      const manifest = this.cache.json.get(manifestName);
      console.log("Manifest loaded:", manifest);

      // Debug log to help diagnose path issues
      console.log("Current document location:", window.location.href);

      // Process image data from manifest and load any additional images
      if (manifest && manifest.images && manifest.images.length > 0) {
        // Start a second loading phase for the assets
        let loadingStarted = false;

        // Loop through each image in the manifest
        manifest.images.forEach(image => {
          let path = image.path;

          // Process non-external paths
          if (!path.startsWith('http')) {
            // Handle different asset types (audio, egg textures, environment textures, etc.)
            if (image.type == 'audio') {
              this.load.audio(image.id, path);
              this.audioKeys.push(image.id);
            } else {
              this.load.image(image.id, path);
              loadingStarted = true;
              
              // Categorize textures by type
              if (image.type == 'egg') this.eggTextureKeys.push(image.id);
              if (image.type == 'env') this.envTextureKeys.push(image.id);
              if (image.type == 'fg') this.fgTextureKeys.push(image.id);
            }
          }
        });

        // If new assets were loaded, start the loader and set callback
        if (loadingStarted) {
          console.log("Starting secondary image loading");
          this.load.once('complete', this.onAssetsLoaded, this);
          this.load.start();
          return; // Exit here - continue once images are loaded
        }
      }
    } else {
      console.warn(`${manifestName} manifest not found, using default eggs`);
    }
  }

  /**
   * Create game objects and initialize the scene
   */
  create() {
    console.log("Creating game elements...");

    // Initialize texture key arrays
    this.eggTextureKeys = [];
    this.envTextureKeys = [];
    this.fgTextureKeys = [];
    this.audioKeys = [];

    // Load assets from the manifest
    this.loadAssets('game-manifest');

    // Initial setup of game world (will be called again after assets load)
    this.setupGameWorld();
  }

  /**
   * Called after secondary assets finish loading
   */
  onAssetsLoaded() {
    console.log("Secondary assets load complete");
    console.log("Available egg textures:", this.eggTextureKeys);
    
    // Initialize sounds with loaded audio assets
    this.initializeSounds();
    
    // Setup the game world with the loaded assets
    this.setupGameWorld();
  }

  /**
   * Play a sound with optional random pitch variation
   * @param {string} soundName - The key of the sound to play
   * @param {boolean} randomPitch - Whether to apply random pitch variation
   */
  playSound(soundName, randomPitch) {
    try {
      if (this.sounds && this.sounds[soundName]) {
        // Apply random pitch if requested
        const soundPitch = randomPitch ? 0.8 + Math.random() * 0.4 : 1.0;

        // Play the sound with the calculated pitch
        this.sounds[soundName].play({
          rate: soundPitch
        });
      } else {
        console.warn(`Sound ${soundName} not found in sounds collection`);
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }

  /**
   * Utility function to clamp a number between min and max values
   * @param {number} num - The number to clamp
   * @param {number} min - The minimum allowed value
   * @param {number} max - The maximum allowed value
   * @returns {number} - The clamped value
   */
  clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
  }

  /**
   * Set up the game world with eggs, environment, and UI
   */
  setupGameWorld() {
    console.log("Setting up game world with eggs...");
    
    // Create a simplex noise instance for natural-looking terrain generation
    let noise;
    try {
      noise = new SimplexNoise();
    } catch (error) {
      console.error('SimplexNoise not available:', error);
      // Fallback to simple random noise if SimplexNoise isn't available
      noise = {
        noise2D: (x, y) => Math.random() * 2 - 1
      };
    }

    // Set camera bounds to match world size
    this.cameras.main.setBounds(0, 0, this.worldSizeWidth, this.worldSizeHeight);

    // Create physics group for eggs
    this.eggs = this.physics.add.group();

    // Track if the special golden egg has been placed
    let goldenEggPlaced = false;
    
    // Populate the world with environment tiles and eggs
    for (let i = 0; i < this.eggGridSizeWidth * this.eggGridSizeHeight; i++) {
      // Calculate grid position
      const x = (i % this.eggGridSizeWidth) * this.eggWidth;
      const y = Math.floor(i / this.eggGridSizeWidth) * this.eggHeight;

      // Generate noise value for this position (-1 to 1)
      let noise_value = noise.noise2D((x / this.eggGridSizeWidth) * 0.05, (y / this.eggGridSizeHeight) * 0.05);
      
      // Convert noise to 0-1 range
      noise_value = (noise_value + 1) * 0.5;
      
      // Select environment texture based on noise value
      let textureKey;
      let index = Math.floor(noise_value * 5);
      textureKey = this.envTextureKeys[index];
      
      // Create environment sprite
      const sprite = this.add.sprite(x + this.eggWidth / 2, y + this.eggHeight / 2, textureKey);
      sprite.setScale(1);

      // Create egg if not on a dirt path (based on noise value)
      if (index < 3) {
        // Select random egg texture
        let index = Math.floor(Math.random() * (this.eggTextureKeys.length - 1));
        textureKey = this.eggTextureKeys[index];
        
        // Mark the winning egg position
        if (i >= this.winningEggIndex && !goldenEggPlaced) {
          goldenEggPlaced = true;
          this.winningEggIndex = i;
        }

        // Create egg sprite with the selected texture
        const egg = this.eggs.create(x + this.eggWidth / 2, y + this.eggHeight / 2, textureKey);

        // Configure egg properties
        egg.setScale(1.15);
        egg.originalScale = egg.scale;
        egg.setInteractive();
        egg.index = i;
        egg.scaleRate = 300 + (Math.random() * 700); // Used for breathing animation

        // Handle egg clicks
        egg.on('pointerdown', () => {
          // Increment counter and update text
          this.eggsCollected++;
          this.collected.text = `Eggs Collected ${this.eggsCollected}`;
          
          if (egg.index === this.winningEggIndex) {
            // Found the winning egg!
            egg.setTexture(this.eggTextureKeys[this.eggTextureKeys.length-1]);
            this.showWinMessage();
            this.playSound('audio02', false); // Play win sound
          } else {
            // Regular egg - make it disappear
            egg.setVisible(false);
            egg.disableInteractive();
            this.playSound('audio01', true); // Play pickup sound with random pitch
          }
        });
      }

      // Add random foreground decorations (grass, flowers, etc.)
      if (Math.random() < 0.4 && this.fgTextureKeys.length > 0) {
        const fg_index = Math.floor(Math.random() * this.fgTextureKeys.length);
        textureKey = this.fgTextureKeys[fg_index];
        const sprite = this.add.sprite(x + this.eggWidth / 2, y + this.eggHeight / 2, textureKey);
        sprite.setScale(1.2 + Math.random() * 0.5); // Random size variation
      }
    }

    // Set camera zoom level
    this.cameras.main.setZoom(0.5);

    // Set up camera drag controls
    this.setupCameraDragControls();

    // Add UI elements (instructions and egg counter)
    this.setupUI();
  }

  /**
   * Set up camera drag controls for navigating the world
   */
  setupCameraDragControls() {
    // Track drag state and starting position
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.startScrollX = 0;
    this.startScrollY = 0;

    // Handle mouse/touch down
    this.input.on('pointerdown', (pointer) => {
      // Store start positions
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.startScrollX = this.cameras.main.scrollX;
      this.startScrollY = this.cameras.main.scrollY;
    });

    // Handle mouse/touch move for camera panning
    this.input.on('pointermove', (pointer) => {
      if (this.isDragging) {
        // Calculate how far we've dragged
        const dragX = pointer.x - this.dragStartX;
        const dragY = pointer.y - this.dragStartY;

        // Set camera position based on the drag distance
        this.cameras.main.scrollX = this.startScrollX - dragX / this.cameras.main.zoom;
        this.cameras.main.scrollY = this.startScrollY - dragY / this.cameras.main.zoom;

        // Prevent default browser behavior
        if (pointer.event) {
          pointer.event.preventDefault();
          pointer.event.stopPropagation();
        }
      }
    });

    // Handle mouse/touch up and pointer leaving game area
    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.input.on('pointerout', () => {
      this.isDragging = false;
    });
  }

  /**
   * Set up UI elements like instructions and egg counter
   */
  setupUI() {
    // Add instructions text
    const instructions = this.add.text(0, 0, 'Find the special egg!\nClick eggs to pickup.\nDrag to move around.', {
      fontSize: '30px',
      fontFamily: 'Arial, sans-serif',
      color: '#000000',
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      align: 'center',
      padding: { x: 10, y: 10 },
      shadow: {
        offsetX: 3,
        offsetY: 3,
        color: 'rgba(0, 0, 0, 0.25)',
        blur: 2,
        fill: true
      }
    });
    instructions.setOrigin(1, 1);
    instructions.setScrollFactor(0);
    instructions.setDepth(100);
    instructions.setPosition(
      this.cameras.main.width + 700,
      this.cameras.main.height + 300
    );

    // Add egg collection counter
    this.collected = this.add.text(0, 0, `Eggs Collected ${this.eggsCollected}`, {
      fontSize: '30px',
      fontFamily: 'Arial, sans-serif',
      color: '#000000',
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      align: 'center',
      padding: { x: 10, y: 10 },
      shadow: {
        offsetX: 3,
        offsetY: 3,
        color: 'rgba(0, 0, 0, 0.25)',
        blur: 2,
        fill: true
      }
    });
    this.collected.setOrigin(0, 1);
    this.collected.setScrollFactor(0);
    this.collected.setDepth(100);
    this.collected.setPosition(
      -800,
      this.cameras.main.height + 300
    );
  }

  /**
   * Update method called every frame
   * @param {number} time - Current time
   * @param {number} delta - Time since last frame
   */
  update(time, delta) {
    // Safety check - make sure eggs group exists
    if (!this.eggs) return;

    // Get all children but with safety check
    const children = this.eggs.getChildren();
    if (!children || children.length === 0) return;

    // Only update visible eggs and include error handling
    children.forEach(egg => {
      try {
        if (egg && egg.visible) {
          // Make sure originalScale exists
          if (egg.originalScale === undefined) {
            egg.originalScale = egg.scale || 1;
          }
          // Apply "breathing" animation to eggs
          let breathScale = 1 + Math.sin(time / egg.scaleRate) * 0.05;
          egg.setScale(egg.originalScale * breathScale);
        }
      } catch (e) {
        console.error("Error animating egg:", e);
      }
    });
  }

  /**
   * Display win message when the player finds the special egg
   */
  showWinMessage() {
    // Add a background to make text more visible
    const textBg = this.add.rectangle(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      800,
      200,
      0x000000,
      0.5
    );
    textBg.setOrigin(0.5);
    textBg.setScrollFactor(0);
    textBg.setDepth(1);

    // Add the win message
    const winText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      `YOU FOUND THE GOLDEN EGG!\nTAKE A PICTURE AND\nSUBMIT TO TEAMS FOR A PRIZE!`,
      {
        fontSize: '48px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffff00',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: '#000',
          blur: 5,
          fill: true
        }
      }
    );
    winText.setOrigin(0.5);
    winText.setScrollFactor(0);
    winText.setDepth(2);
  }
}

// Game configuration
const config = {
  type: Phaser.AUTO,         // Use WebGL if available, fall back to Canvas
  width: window.innerWidth,  // Full browser width
  height: window.innerHeight, // Full browser height
  backgroundColor: '#00c947', // Grass green background
  parent: 'game-container',   // ID of container element
  physics: {
    default: 'arcade'        // Simple physics system
  },
  input: {
    activePointers: 2,       // Support multi-touch
    dragDistanceThreshold: 5 // Helps to detect drags vs. clicks accurately
  },
  scene: [EggHuntGame]       // Our game scene
};

// Create and start the game
const game = new Phaser.Game(config);

// Handle window resizing to keep the game responsive
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});