/**
 * fluid-light.js - 鼠标跟随光效
 */

/**
 * 初始化鼠标跟随光效
 * @param {Object} options - 配置选项
 */
function initFluidLight(options = {}) {
    const defaultOptions = {
        size: 300,
        color: 'rgba(109, 40, 217, 0.15)',
        blur: 80,
        zIndex: 0
    };

    const config = { ...defaultOptions, ...options };

    // 创建光效元素
    const light = document.createElement('div');
    light.className = 'fluid-light';
    light.style.cssText = `
        position: fixed;
        width: ${config.size}px;
        height: ${config.size}px;
        background: radial-gradient(circle, ${config.color} 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        filter: blur(${config.blur}px);
        z-index: ${config.zIndex};
        transform: translate(-50%, -50%);
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    document.body.appendChild(light);

    // 鼠标移动跟随
    let mouseX = 0;
    let mouseY = 0;
    let lightX = 0;
    let lightY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        light.style.opacity = '1';
    });

    document.addEventListener('mouseleave', () => {
        light.style.opacity = '0';
    });

    // 平滑跟随动画
    function animate() {
        const ease = 0.1;
        lightX += (mouseX - lightX) * ease;
        lightY += (mouseY - lightY) * ease;
        light.style.left = lightX + 'px';
        light.style.top = lightY + 'px';
        requestAnimationFrame(animate);
    }

    animate();

    return light;
}

/**
 * 为特定元素添加悬停光效
 * @param {string} selector - CSS选择器
 */
function addHoverGlow(selector) {
    const elements = document.querySelectorAll(selector);

    elements.forEach(el => {
        el.addEventListener('mouseenter', function() {
            this.style.boxShadow = '0 0 30px rgba(109, 40, 217, 0.3)';
        });

        el.addEventListener('mouseleave', function() {
            this.style.boxShadow = '';
        });
    });
}

/**
 * 创建粒子光效背景
 * @param {string} containerId - 容器元素ID
 * @param {number} particleCount - 粒子数量
 */
function createParticleBackground(containerId, particleCount = 50) {
    const container = document.getElementById(containerId);
    if (!container) return;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 4 + 1}px;
            height: ${Math.random() * 4 + 1}px;
            background: rgba(255, 255, 255, ${Math.random() * 0.5 + 0.1});
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: particleFloat ${Math.random() * 10 + 10}s linear infinite;
            animation-delay: -${Math.random() * 10}s;
        `;
        container.appendChild(particle);
    }

    // 添加动画样式
    if (!document.getElementById('particle-styles')) {
        const style = document.createElement('style');
        style.id = 'particle-styles';
        style.textContent = `
            @keyframes particleFloat {
                0%, 100% {
                    transform: translateY(0) translateX(0);
                    opacity: 0;
                }
                10% {
                    opacity: 1;
                }
                90% {
                    opacity: 1;
                }
                50% {
                    transform: translateY(-100px) translateX(50px);
                }
            }
        `;
        document.head.appendChild(style);
    }
}