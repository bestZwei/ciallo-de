import { createRoot } from 'react-dom/client';
import React, { useEffect, useRef, useState } from 'react';
import Ciallo from './components/Ciallo';
import Jumper from './components/Jumper';
import WelcomeModal from './components/WelcomeModal';
// TODO:晚点改成cdn形式
import meguru from './assets/meguru.aac'

// Enhanced colorMap with more variety and better spacing
const colorMap = [{
    dur: 18,
    color: 'red',
    size: "clamp(15px, 4vw, 35px)",
    shadow: '2px 2px 4px rgba(255,0,0,0.3)'
}, {
    dur: 22,
    color: 'aqua',
    size: "clamp(18px, 4.5vw, 40px)",
    shadow: '2px 2px 4px rgba(0,255,255,0.3)'
}, {
    dur: 16,
    color: 'coral',
    size: "clamp(12px, 3vw, 25px)",
    shadow: '1px 1px 3px rgba(255,127,80,0.4)'
}, {
    dur: 15,
    color: 'greenyellow',
    size: "clamp(14px, 3.5vw, 29px)",
    shadow: '2px 2px 4px rgba(173,255,47,0.3)'
}, {
    dur: 17,
    color: 'gold',
    size: 'clamp(10px, 2.5vw, 18px)',
    shadow: '1px 1px 2px rgba(255,215,0,0.4)'
}, {
    dur: 20,
    color: 'orange',
    size: 'clamp(20px, 5vw, 50px)',
    shadow: '3px 3px 6px rgba(255,165,0,0.3)'
}, {
    dur: 16,
    color: 'pink',
    size: 'clamp(25px, 6vw, 60px)',
    shadow: '2px 2px 5px rgba(255,192,203,0.4)'
}, {
    dur: 25,
    color: 'cyan',
    size: "clamp(14px, 3.5vw, 29px)",
    shadow: '2px 2px 4px rgba(0,255,255,0.3)'
}, {
    dur: 19,
    color: 'lightgreen',
    size: "clamp(16px, 4vw, 32px)",
    shadow: '2px 2px 4px rgba(144,238,144,0.3)'
}, {
    dur: 21,
    color: 'violet',
    size: "clamp(13px, 3.2vw, 26px)",
    shadow: '2px 2px 4px rgba(238,130,238,0.3)'
}]

const audioList = [meguru]

const App = () => {
    const [showWelcome, setShowWelcome] = useState(true);
    const audioIndexRef = useRef(0);
    const activeAnimationsRef = useRef(0);
    const audioObjectsRef = useRef([]);
    const audioInitializedRef = useRef(false);
    const occupiedPositionsRef = useRef(new Set());
    const maxAnimations = window.innerWidth <= 768 ? 3 : 8;

    // Position management for bullet screens
    const getAvailablePosition = () => {
        const viewportHeight = window.innerHeight;
        const centerTop = viewportHeight * 0.3;
        const centerBottom = viewportHeight * 0.7;
        const minSpacing = window.innerWidth <= 768 ? 60 : 80;
        
        // Create available zones (avoid center area)
        const topZone = { start: viewportHeight * 0.05, end: centerTop };
        const bottomZone = { start: centerBottom, end: viewportHeight * 0.95 };
        
        const zones = [topZone, bottomZone];
        
        for (const zone of zones) {
            for (let y = zone.start; y <= zone.end; y += minSpacing) {
                const positionKey = Math.floor(y / minSpacing) * minSpacing;
                if (!occupiedPositionsRef.current.has(positionKey)) {
                    occupiedPositionsRef.current.add(positionKey);
                    // Auto-clear position after animation
                    setTimeout(() => {
                        occupiedPositionsRef.current.delete(positionKey);
                    }, 3000);
                    return y;
                }
            }
        }
        
        // Fallback: random position in safe zones
        const zone = zones[Math.floor(Math.random() * zones.length)];
        return Math.random() * (zone.end - zone.start) + zone.start;
    };

    const randomColor = () => {
        const colors = [
            'rgb(255, 105, 180)', 'rgb(135, 206, 250)', 'rgb(255, 165, 0)',
            'rgb(144, 238, 144)', 'rgb(221, 160, 221)', 'rgb(255, 182, 193)',
            'rgb(173, 216, 230)', 'rgb(240, 230, 140)', 'rgb(255, 218, 185)'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // 预加载和初始化音频对象
    const initAudio = () => {
        audioList.forEach((audioSrc, index) => {
            const audio = new Audio(audioSrc);
            audio.preload = 'auto';
            audio.volume = 0.7;
            audioObjectsRef.current[index] = audio;
        });
        audioInitializedRef.current = true;
    };

    const handleWelcomeClose = () => {
        setShowWelcome(false);
        // 用户点击欢迎按钮时初始化音频
        if (!audioInitializedRef.current) {
            initAudio();
        }
    };

    const cialloAppend = (event) => {
        if (activeAnimationsRef.current >= maxAnimations) {
            return;
        }

        const x = event.pageX || (event.touches && event.touches[0].pageX);
        const y = event.pageY || (event.touches && event.touches[0].pageY);
        
        if (!x || !y) return;

        const span = document.createElement('span')
        span.innerHTML = 'Ciallo～(∠・ω< )⌒★';
        
        const isMobile = window.innerWidth <= 768;
        const fontSize = isMobile ? Math.random() * 10 + 12 : Math.random() * 20 + 15;
        const randomRotation = (Math.random() - 0.5) * 20; // -10 to 10 degrees
        
        span.style.cssText = `
            position: fixed; 
            left: ${x}px; 
            top: ${y - 20}px; 
            color: ${randomColor()}; 
            font-weight: bold;
            font-size: ${fontSize}px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.4), 0 0 10px currentColor;
            z-index: 1000;
            pointer-events: none;
            user-select: none;
            will-change: transform, opacity;
            filter: drop-shadow(0 0 5px rgba(255,255,255,0.3));
        `;
        document.body.appendChild(span);
        
        activeAnimationsRef.current++;
        
        const animationDuration = isMobile ? 1500 : 2000;
        const moveDistance = isMobile ? 100 : 180;
        const bounceHeight = isMobile ? 30 : 50;
        
        const animation = span.animate([
            { 
                transform: `scale(0) rotate(${randomRotation}deg)`, 
                opacity: 1,
                top: `${y - 20}px`,
                filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.3)) brightness(1.2)'
            },
            { 
                transform: `scale(1.2) rotate(${randomRotation + 5}deg)`, 
                opacity: 1,
                top: `${y - bounceHeight}px`,
                filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.4)) brightness(1.1)'
            },
            { 
                transform: `scale(1) rotate(${randomRotation - 3}deg)`, 
                opacity: 0,
                top: `${y - moveDistance}px`,
                filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.2)) brightness(1)'
            }
        ], {
            duration: animationDuration,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        });
        
        // 使用预加载的音频对象播放音频
        if (audioInitializedRef.current && audioObjectsRef.current.length > 0) {
            const audio = audioObjectsRef.current[audioIndexRef.current];
            if (audio) {
                // 重置音频到开始位置以确保能够重复播放
                audio.currentTime = 0;
                const playPromise = audio.play();
                
                // 处理播放失败的情况
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log('Audio play failed:', error);
                    });
                }
                
                audioIndexRef.current = (audioIndexRef.current + 1) % audioObjectsRef.current.length;
            }
        }
        
        animation.onfinish = () => {
            activeAnimationsRef.current--;
            span.remove();
        }
    }

    useEffect(() => {
        // 只有当欢迎弹窗关闭后才添加事件监听器
        if (!showWelcome) {
            const handleTouch = (e) => {
                e.preventDefault(); // Prevent scrolling on touch
                cialloAppend(e);
            };

            document.body.addEventListener('click', cialloAppend);
            document.body.addEventListener('touchstart', handleTouch, { passive: false });

            return () => {
                document.body.removeEventListener('click', cialloAppend);
                document.body.removeEventListener('touchstart', handleTouch);
            }
        }
    }, [showWelcome]);

    return (
        <div style={{
            background: 'linear-gradient(45deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
            minHeight: '100vh',
            minHeight: '100dvh', // Use dynamic viewport height
            width: '100vw',
            position: 'fixed',
            top: 0,
            left: 0,
            overflow: 'hidden',
            touchAction: 'manipulation',
            // Add safe area support for mobile
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)'
        }}>
            {showWelcome && <WelcomeModal onClose={handleWelcomeClose} />}
            
            <Jumper />
            <div>
                {colorMap.map((item, index) => (
                    <Ciallo 
                        key={index} 
                        {...item} 
                        top={getAvailablePosition()}
                        delay={Math.random() * 5}
                    />
                ))}
            </div>
            <footer style={{
                position: 'fixed',
                bottom: 'max(10px, env(safe-area-inset-bottom))',
                right: '15px',
                fontSize: 'clamp(10px, 2.5vw, 12px)',
                color: 'rgba(255, 255, 255, 0.6)',
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                padding: '5px 10px',
                borderRadius: '15px',
                backdropFilter: 'blur(5px)',
                zIndex: 1000,
                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)'
            }}>
                <a 
                    href="https://github.com/bestZwei/ciallo-de" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                        color: 'inherit',
                        textDecoration: 'none',
                        transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.color = 'rgba(255, 255, 255, 0.9)';
                        e.target.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.color = 'rgba(255, 255, 255, 0.6)';
                        e.target.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.3)';
                    }}
                >
                    GitHub
                </a>
            </footer>
        </div>
    );
}

const domNode = document.getElementById('root');
const root = createRoot(domNode);
root.render(<App />);
