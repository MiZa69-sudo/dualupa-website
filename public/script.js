// ===== ЧАСТИЦЫ =====
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function createParticle() {
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.2,
        pulse: Math.random() * Math.PI * 2,
    };
}

for (let i = 0; i < 80; i++) particles.push(createParticle());

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, i) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.pulse += 0.02;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const opacity = p.opacity + Math.sin(p.pulse) * 0.2;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(181, 126, 236, ${opacity})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#B57EEC';
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
            if (dist < 120) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = `rgba(150, 51, 249, ${0.08 * (1 - dist / 120)})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    });
    requestAnimationFrame(animate);
}
animate();

// ===== КНОПКА "СКАЧАТЬ ЛАУНЧЕР" =====
document.getElementById('play-btn').addEventListener('click', () => {
    alert('Лаунчер скоро будет доступен для скачивания!');
});

console.log('DUA LUPA website loaded 🚀');
