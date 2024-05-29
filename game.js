const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    parent: 'game' // This will place the game inside the div with id "game"
};

const game = new Phaser.Game(config);

let waitingTime = 0; // Initialize waiting time in seconds
let swipeStartX = 0; // Initialize swipe start X position
let swipeStartY = 0; // Initialize swipe start Y position
let swipeEndX = 0; // Initialize swipe end X position
let swipeEndY = 0; // Initialize swipe end Y position

let activityText; // Text element to display activities and behaviors
let notificationText; // Text element to display notifications
let timerPaused = true; // Flag to control the timer

let notifications = ['The doctor will see you soon', 'Please be patient', 'Your turn is coming up']; // Notifications array

function preload () {
    this.load.image('waitingRoom', 'assets/waitingRoom.png'); // Placeholder for the waiting room background
    this.load.spritesheet('character', 'assets/character.png', { frameWidth: 64, frameHeight: 64 }); // Placeholder for the player character
    
    // Load NPC images
    this.load.spritesheet('npc1', 'assets/npc1.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('npc2', 'assets/npc2.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('npc3', 'assets/npc3.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('npc4', 'assets/npc4.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('npc5', 'assets/npc5.png', { frameWidth: 64, frameHeight: 64 });

    // Load activity sprites
    this.load.image('magazine', 'assets/magazine.png'); // Placeholder for the magazine activity
    this.load.image('tv', 'assets/tv.png'); // Placeholder for the TV activity
    this.load.image('radio', 'assets/radio.png'); // Placeholder for the radio activity
}

function create () {
    this.add.image(400, 300, 'waitingRoom');

    // Player character setup
    this.player = this.physics.add.sprite(100, 100, 'character');
    this.player.setDisplaySize(64, 64);
    this.player.setCollideWorldBounds(true);

    // NPCs setup
    const npcImages = ['npc1', 'npc2', 'npc3', 'npc4', 'npc5'];
    this.npcs = this.physics.add.group();

    for (let i = 0; i < 5; i++) {
        const x = Phaser.Math.Between(50, 750);
        const y = Phaser.Math.Between(50, 550);
        const npc = this.npcs.create(x, y, npcImages[i]);
        npc.setDisplaySize(64, 64);
        npc.setBounce(0);
        npc.setCollideWorldBounds(true);
        npc.targetPoint = { x: x, y: y };
        npc.isMoving = false;
        npc.pauseTime = Phaser.Math.Between(1000, 10000);
        npc.nextMoveTime = this.time.now + npc.pauseTime;
        npc.setVelocity(0, 0);
    }

    this.physics.add.collider(this.player, this.npcs, playerNpcCollision, null, this);
    this.physics.add.collider(this.npcs, this.npcs);

    // Activities setup
    this.activities = this.physics.add.group();

    // Magazine activity
    const magazine = this.activities.create(150, 400, 'magazine');
    magazine.setDisplaySize(64, 64);
    magazine.activityType = 'reading a magazine';

    // TV activity
    const tv = this.activities.create(400, 150, 'tv');
    tv.setDisplaySize(64, 64);
    tv.activityType = 'watching TV';

    // Radio activity
    const radio = this.activities.create(650, 400, 'radio');
    radio.setDisplaySize(64, 64);
    radio.activityType = 'listening to the radio';

    this.physics.add.overlap(this.player, this.activities, doActivity, null, this);

    this.cursors = this.input.keyboard.createCursorKeys();

    // Real-time clock
    this.timeText = this.add.text(10, 10, '', { font: '16px Courier', fill: '#ffffff' });
    this.timeEvent = this.time.addEvent({ delay: 1000, callback: updateTime, callbackScope: this, loop: true });

    // Time waited label and timer
    this.add.text(10, 30, 'Time Waited: ', { font: '16px Courier', fill: '#ffffff' });
    this.waitedTimeText = this.add.text(130, 30, formatTime(waitingTime), { font: '16px Courier', fill: '#ffffff' });

    // Notifications text
    notificationText = this.add.text(400, 50, '', { font: '16px Courier', fill: '#ff0000' }).setOrigin(0.5, 0);

    // Activity text
    activityText = this.add.text(400, 580, '', { font: '16px Courier', fill: '#ffffff' }).setOrigin(0.5, 1);

    // Touch controls for mobile
    this.input.on('pointerdown', startSwipe, this);
    this.input.on('pointerup', endSwipe, this);

    // Update welcome screen time
    updateWelcomeTime();
    this.time.addEvent({ delay: 1000, callback: updateWelcomeTime, callbackScope: this, loop: true });

    // Hide the welcome screen and start the game
    document.getElementById('check-in-button').addEventListener('click', () => {
        document.getElementById('welcome-screen').style.display = 'none';
        timerPaused = false;
        showNotification(); // Show a notification immediately after checking in
        scheduleNotification(); // Schedule notifications
        game.scene.resume('default');
    });

    game.scene.pause('default');
}

function update () {
    if (timerPaused) return; // Skip update if the timer is paused

    // Character movement with keyboard
    this.player.setVelocity(0);

    if (this.cursors.left.isDown) {
        this.player.setVelocityX(-160);
    } else if (this.cursors.right.isDown) {
        this.player.setVelocityX(160);
    }

    if (this.cursors.up.isDown) {
        this.player.setVelocityY(-160);
    } else if (this.cursors.down.isDown) {
        this.player.setVelocityY(160);
    }

    // NPC human-like movement
    this.npcs.children.iterate((npc) => {
        if (!npc.isMoving && this.time.now >= npc.nextMoveTime) {
            const maxDistance = 400; // Half of the canvas width or height
            const minX = Math.max(50, npc.x - maxDistance);
            const maxX = Math.min(750, npc.x + maxDistance);
            const minY = Math.max(50, npc.y - maxDistance);
            const maxY = Math.min(550, npc.y + maxDistance);
            npc.targetPoint = {
                x: Phaser.Math.Between(minX, maxX),
                y: Phaser.Math.Between(minY, maxY)
            };
            npc.isMoving = true;
        }

        if (npc.isMoving) {
            const distanceX = npc.targetPoint.x - npc.x;
            const distanceY = npc.targetPoint.y - npc.y;

            const velocity = 100;

            if (Math.abs(distanceX) < 10 && Math.abs(distanceY) < 10) {
                npc.setVelocity(0, 0);
                npc.isMoving = false;
                npc.pauseTime = Phaser.Math.Between(1000, 10000);
                npc.nextMoveTime = this.time.now + npc.pauseTime;
            } else {
                const velocityX = (distanceX > 0 ? 1 : -1) * (Math.abs(distanceX) > 10 ? velocity : 0);
                const velocityY = (distanceY > 0 ? 1 : -1) * (Math.abs(distanceY) > 10 ? velocity : 0);
                npc.setVelocity(velocityX, velocityY);
            }
        }
    });
}

function playerNpcCollision (player, npc) {
    npc.setVelocity(0, 0); // Stop the NPC from moving
    npc.isMoving = false; // Set NPC to not moving

    // Optionally, block the player movement as well
    if (player.body.touching.up || player.body.touching.down || player.body.touching.left || player.body.touching.right) {
        player.setVelocity(0, 0); // Stop player movement
    }
}

function doActivity (player, activity) {
    activityText.setText(`You are ${activity.activityType}`);
}

function updateTime () {
    if (timerPaused) return; // Skip update if the timer is paused

    const now = new Date();
    this.timeText.setText('Time: ' + now.toLocaleTimeString());

    // Update waiting time
    waitingTime++;
    this.waitedTimeText.setText(formatTime(waitingTime));
}

function updateWelcomeTime() {
    const now = new Date();
    const welcomeTimeElement = document.getElementById('welcome-time');
    if (welcomeTimeElement) {
        welcomeTimeElement.innerText = 'Time: ' + now.toLocaleTimeString();
    }
}

function showNotification () {
    const notification = notifications[Math.floor(Math.random() * notifications.length)];
    notificationText.setText(notification);
}

function scheduleNotification() {
    const delay = Phaser.Math.Between(15000, 30000); // Delay between 15 and 30 seconds
    game.scene.keys.default.time.addEvent({
        delay: delay,
        callback: () => {
            showNotification();
            scheduleNotification(); // Schedule the next notification
        },
        callbackScope: game.scene.keys.default
    });
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secondsLeft = seconds % 60;
    return `${minutes}:${secondsLeft.toString().padStart(2, '0')}`;
}

// Swipe gesture handling
function startSwipe(pointer) {
    swipeStartX = pointer.x;
    swipeStartY = pointer.y;
}

function endSwipe(pointer) {
    swipeEndX = pointer.x;
    swipeEndY = pointer.y;

    const deltaX = swipeEndX - swipeStartX;
    const deltaY = swipeEndY - swipeStartY;

    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    const moveDistance = 1500; // Increase the movement distance

    if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (deltaX > 0) {
            // Swipe right
            this.player.setVelocityX(moveDistance);
        } else {
            // Swipe left
            this.player.setVelocityX(-moveDistance);
        }
    } else {
        // Vertical swipe
        if (deltaY > 0) {
            // Swipe down
            this.player.setVelocityY(moveDistance);
        } else {
            // Swipe up
            this.player.setVelocityY(-moveDistance);
        }
    }

    // Reset velocities after a short duration to prevent continuous movement
    this.time.delayedCall(500, () => {
        this.player.setVelocity(0);
    }, [], this);
}
