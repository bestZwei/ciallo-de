import { createRoot } from 'react-dom/client';
import React, { useEffect, useRef, useState } from 'react';
import Ciallo from './components/Ciallo';
import Jumper from './components/Jumper';
import WelcomeModal from './components/WelcomeModal';
// TODO:晚点改成cdn形式
import meguru from './assets/meguru.aac'

// Enhanced colorMap with more variety
const colorMap = [{
    dur: 18,
    color: 'red',
    size: "clamp(15px, 4vw, 35px)",
    top: `${Math.random() * 30 + 10}vh`, // Upper area
    lane: 0
}, {
    dur: 22,
    color: 'aqua',
    size: "clamp(18px, 4.5vw, 40px)",
    top: `${Math.random() * 30 + 65}vh`, // Lower area
    lane: 1
}, {
    dur: 16,
    color: 'coral',
    size: "clamp(12px, 3vw, 25px)",
    top: `${Math.random() * 25 + 12}vh`,
    lane: 2
}, {
    dur: 15,
    color: 'greenyellow',
    size: "clamp(14px, 3.5vw, 29px)",
    top: `${Math.random() * 25 + 70}vh`,
    lane: 3
}, {
    dur: 17,
    color: 'gold',
    size: 'clamp(10px, 2.5vw, 18px)',
    top: `${Math.random() * 20 + 15}vh`,
    lane: 4
}, {
    dur: 20,
    color: 'orange',
    size: 'clamp(20px, 5vw, 50px)',
    top: `${Math.random() * 20 + 75}vh`,
    lane: 5
}, {
    dur: 16,
    color: 'pink',
    size: 'clamp(25px, 6vw, 60px)',
    top: `${Math.random() * 15 + 8}vh`,
    lane: 6
}, {
    dur: 25,
    color: 'cyan',
    size: "clamp(14px, 3.5vw, 29px)",
    top: `${Math.random() * 15 + 80}vh`,
    lane: 7
}]

const audioList = [meguru]

const App = () => {
    const [showWelcome, setShowWelcome] = useState(true);
    const audioIndexRef = useRef(0);
    const activeAnimationsRef = useRef(0);
    const audioObjectsRef = useRef([]);
    const audioInitializedRef = useRef(false);
    const occupiedAreasRef = useRef(new Set()); // Track occupied grid cells
    const maxAnimations = window.innerWidth <= 768 ? 3 : 8;

    // Grid system for collision detection
    const gridCols = 20;
    const gridRows = 15;
    
    const getGridKey = (x, y) => {
        const col = Math.floor((x / window.innerWidth) * gridCols);
        const row = Math.floor((y / window.innerHeight) * gridRows);
        return `${col}-${row}`;
    };

    const isAreaOccupied = (x, y, width = 200, height = 50) => {
        const keys = [];
        const startCol = Math.floor((x / window.innerWidth) * gridCols);
        const endCol = Math.floor(((x + width) / window.innerWidth) * gridCols);
        const startRow = Math.floor((y / window.innerHeight) * gridRows);
        const endRow = Math.floor(((y + height) / window.innerHeight) * gridRows);
        
        for (let col = startCol; col <= endCol; col++) {
            for (let row = startRow; row <= endRow; row++) {
                keys.push(`${col}-${row}`);
            }
        }
        
        return keys.some(key => occupiedAreasRef.current.has(key));
    };

    const occupyArea = (x, y, width = 200, height = 50) => {
        const keys = [];
        const startCol = Math.floor((x / window.innerWidth) * gridCols);
        const endCol = Math.floor(((x + width) / window.innerWidth) * gridCols);
        const startRow = Math.floor((y / window.innerHeight) * gridRows);
        const endRow = Math.floor(((y + height) / window.innerHeight) * gridRows);
        
        for (let col = startCol; col <= endCol; col++) {
            for (let row = startRow; row <= endRow; row++) {
                const key = `${col}-${row}`;
                keys.push(key);
                occupiedAreasRef.current.add(key);
            }
        }
        
        return keys;
    };

    const freeArea = (keys) => {
        keys.forEach(key => occupiedAreasRef.current.delete(key));
    };

    // Check if position is in center exclusion zone
    const isInCenterZone = (x, y) => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const exclusionWidth = Math.min(600, window.innerWidth * 0.8);
        const exclusionHeight = Math.min(200, window.innerHeight * 0.3);
        
        return (
            x > centerX - exclusionWidth / 2 &&
            x < centerX + exclusionWidth / 2 &&
            y > centerY - exclusionHeight / 2 &&
            y < centerY + exclusionHeight / 2
        );
    };

    // Find safe position for click animation
    const findSafePosition = (originalX, originalY) => {
        const attempts = 20;
        const textWidth = 200;
        const textHeight = 50;
        
        for (let i = 0; i < attempts; i++) {
            let x = originalX;
            let y = originalY;
            
            if (i > 0) {
                // Add randomization after first attempt
                const offsetX = (Math.random() - 0.5) * 300;
                const offsetY = (Math.random() - 0.5) * 200;
                x = Math.max(0, Math.min(window.innerWidth - textWidth, originalX + offsetX));
                y = Math.max(0, Math.min(window.innerHeight - textHeight, originalY + offsetY));
            }
            
            if (!isInCenterZone(x, y) && !isAreaOccupied(x, y, textWidth, textHeight)) {
                return { x, y };
            }
        }
        
        // Fallback: use corner positions
        const corners = [
            { x: 50, y: 50 },
            { x: window.innerWidth - 250, y: 50 },
            { x: 50, y: window.innerHeight - 100 },
            { x: window.innerWidth - 250, y: window.innerHeight - 100 }
        ];
        
        for (const corner of corners) {
            if (!isAreaOccupied(corner.x, corner.y, textWidth, textHeight)) {
                return corner;
            }
        }
        
        return { x: originalX, y: originalY }; // Last resort
    };

    const randomColor = () => {
        const colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
            '#dda0dd', '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e9'
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

        const safePosition = findSafePosition(x, y);
        const span = document.createElement('span');
        
        // Enhanced text variations
        const textVariations = [
            'Ciallo～(∠・ω< )⌒★',
            'Ciallo～♪(∠・ω< )⌒☆',
            'Ciallo～✨(∠・ω< )⌒★',
            'Ciallo～💫(∠・ω< )⌒☆',
            'Ciallo～🌟(∠・ω< )⌒★'
        ];
        
        span.innerHTML = textVariations[Math.floor(Math.random() * textVariations.length)];
        
        const isMobile = window.innerWidth <= 768;
        const fontSize = isMobile ? Math.random() * 8 + 14 : Math.random() * 15 + 18;
        const rotation = (Math.random() - 0.5) * 30; // Random rotation
        
        span.style.cssText = `
            position: fixed; 
            left: ${safePosition.x}px; 
            top: ${safePosition.y - 20}px; 
            color: ${randomColor()}; 
            font-weight: bold;
            font-size: ${fontSize}px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3), 0 0 10px currentColor;
            z-index: 1000;
            pointer-events: none;
            user-select: none;
            will-change: transform, opacity;
            transform: rotate(${rotation}deg);
            filter: drop-shadow(0 0 5px currentColor);
        `;
        document.body.appendChild(span);
        
        activeAnimationsRef.current++;
        
        // Occupy the area
        const occupiedKeys = occupyArea(safePosition.x, safePosition.y - 20);
        
        const animationDuration = isMobile ? 1800 : 2500;
        const moveDistance = isMobile ? 120 : 200;
        const bounceHeight = Math.random() * 30 + 20;
        
        const animation = span.animate([
            { 
                transform: `scale(0) rotate(${rotation}deg) translateY(0px)`, 
                opacity: 1,
                filter: 'drop-shadow(0 0 5px currentColor) hue-rotate(0deg)'
            },
            { 
                transform: `scale(1.2) rotate(${rotation + 10}deg) translateY(-${bounceHeight}px)`, 
                opacity: 1,
                filter: 'drop-shadow(0 0 15px currentColor) hue-rotate(180deg)'
            },
            { 
                transform: `scale(1) rotate(${rotation - 5}deg) translateY(-${moveDistance}px)`, 
                opacity: 0.8,
                filter: 'drop-shadow(0 0 10px currentColor) hue-rotate(360deg)'
            },
            { 
                transform: `scale(0.8) rotate(${rotation + 15}deg) translateY(-${moveDistance + 50}px)`, 
                opacity: 0,
                filter: 'drop-shadow(0 0 5px currentColor) hue-rotate(180deg)'
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
            freeArea(occupiedKeys);
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
                {colorMap.map((item, index) => <Ciallo key={index} {...item} />)}
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
