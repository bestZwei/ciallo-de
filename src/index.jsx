import { createRoot } from 'react-dom/client';
import React, { useEffect, useRef } from 'react';
import Ciallo from './components/Ciallo';
import Jumper from './components/Jumper';
// TODO:晚点改成cdn形式
import meguru from './assets/meguru.aac'

// Reduce colorMap items for mobile performance
const colorMap = [{
    dur: 12,
    color: 'red',
    size: "clamp(15px, 4vw, 35px)"
}, {
    dur: 15,
    color: 'aqua',
    size: "clamp(18px, 4.5vw, 40px)"
}, {
    dur: 11,
    color: 'coral',
    size: "clamp(12px, 3vw, 25px)"
}, {
    dur: 10,
    color: 'greenyellow',
    size: "clamp(14px, 3.5vw, 29px)"
}, {
    dur: 12,
    color: 'gold',
    size: 'clamp(10px, 2.5vw, 18px)'
}, {
    dur: 15,
    color: 'orange',
    size: 'clamp(20px, 5vw, 50px)'
}, {
    dur: 11,
    color: 'pink',
    size: 'clamp(25px, 6vw, 60px)'
}, {
    dur: 18,
    color: 'cyan',
    size: "clamp(14px, 3.5vw, 29px)"
}]

const audioList = [meguru]

const App = () => {
    const audioIndexRef = useRef(0);
    const activeAnimationsRef = useRef(0);
    const audioObjectsRef = useRef([]);
    const audioInitializedRef = useRef(false);
    const maxAnimations = window.innerWidth <= 768 ? 3 : 8; // Limit animations on mobile

    const randomColor = () => {
        const r = Math.floor(Math.random() * 256)
        const g = Math.floor(Math.random() * 256)
        const b = Math.floor(Math.random() * 256)
        return `rgb(${r},${g},${b})`
    }

    // 预加载和初始化音频对象
    useEffect(() => {
        const initAudio = () => {
            audioList.forEach((audioSrc, index) => {
                const audio = new Audio(audioSrc);
                audio.preload = 'auto';
                audio.volume = 0.7;
                audioObjectsRef.current[index] = audio;
            });
            audioInitializedRef.current = true;
        };

        // 在用户首次交互时初始化音频
        const handleFirstInteraction = () => {
            if (!audioInitializedRef.current) {
                initAudio();
                document.removeEventListener('click', handleFirstInteraction);
                document.removeEventListener('touchstart', handleFirstInteraction);
            }
        };

        document.addEventListener('click', handleFirstInteraction);
        document.addEventListener('touchstart', handleFirstInteraction);

        return () => {
            document.removeEventListener('click', handleFirstInteraction);
            document.removeEventListener('touchstart', handleFirstInteraction);
        };
    }, []);

    const cialloAppend = (event) => {
        // Limit concurrent animations to prevent lag
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
        
        span.style.cssText = `
            position: fixed; 
            left: ${x}px; 
            top: ${y - 20}px; 
            color: ${randomColor()}; 
            font-weight: bold;
            font-size: ${fontSize}px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
            z-index: 1000;
            pointer-events: none;
            user-select: none;
            will-change: transform, opacity;
        `;
        document.body.appendChild(span);
        
        activeAnimationsRef.current++;
        
        const animationDuration = isMobile ? 1500 : 2000;
        const moveDistance = isMobile ? 100 : 180;
        
        const animation = span.animate([
            { 
                transform: 'scale(0) rotate(0deg)', 
                opacity: 1,
                top: `${y - 20}px`
            },
            { 
                transform: 'scale(1.1) rotate(5deg)', 
                opacity: 1,
                top: `${y - 40}px`
            },
            { 
                transform: 'scale(1) rotate(-3deg)', 
                opacity: 0,
                top: `${y - moveDistance}px`
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
    }, []);

    return (
        <div style={{
            background: 'linear-gradient(45deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
            minHeight: '100vh',
            width: '100vw',
            position: 'fixed',
            top: 0,
            left: 0,
            overflow: 'hidden',
            touchAction: 'manipulation'
        }}>
            <Jumper />
            <div>
                {colorMap.map((item, index) => <Ciallo key={index} {...item} />)}
            </div>
            <footer style={{
                position: 'fixed',
                bottom: '10px',
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
