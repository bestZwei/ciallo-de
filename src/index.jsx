import { createRoot } from 'react-dom/client';
import React, { useEffect } from 'react';
import Ciallo from './components/Ciallo';
import Jumper from './components/Jumper';
// TODO:晚点改成cdn形式
import meguru from './assets/meguru.aac'

const colorMap = [{
    dur: 12,
    color: 'red',
    size: "35px"
}, {
    dur: 15,
    color: 'aqua',
    size: "40px"
}, {
    dur: 11,
    color: 'coral',
    size: "25px"
}, {
    dur: 7,
    color: 'black',
    size: "19px"
}, {
    dur: 10,
    color: 'greenyellow',
    size: "29px"
}, {
    dur: 12,
    color: 'gold',
    size: '18px'
}, {
    dur: 15,
    color: 'orange',
    size: '50px'
}, {
    dur: 11,
    color: 'pink',
    size: '80px'
}, {
    dur: 12,
    color: 'silver',
    size: "45px"
}, {
    dur: 18,
    color: 'cyan',
    size: "29px"
}, {
    dur: 11,
    color: 'greenyellow',
    size: "23px"
}, {
    dur: 14,
    color: 'grey',
    size: "19px"
}, {
    dur: 6,
    color: 'violet',
    size: "45px"
}, {
    dur: 15,
    color: 'blue',
    size: '26px'
}, {
    dur: 14,
    color: 'green',
    size: '50px'
}, {
    dur: 12,
    color: 'aqua',
    size: '75px'
}, {
    dur: 11,
    color: 'black',
    size: "25px"
}]

const audioList = [meguru]

const App = () => {
    let audioIndex = 0;

    const randomColor = () => {
        const r = Math.floor(Math.random() * 256)
        const g = Math.floor(Math.random() * 256)
        const b = Math.floor(Math.random() * 256)
        return `rgb(${r},${g},${b})`
    }

    const cialloAppend = (event) => {
        const x = event.pageX;
        const y = event.pageY;
        const span = document.createElement('span')
        span.innerHTML = 'Ciallo～(∠・ω< )⌒★';
        // 添加更丰富的样式和动画效果
        span.style.cssText = `
            position: absolute; 
            left: ${x}px; 
            top: ${y - 20}px; 
            color: ${randomColor()}; 
            font-weight: bold;
            font-size: ${Math.random() * 20 + 15}px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            z-index: 1000;
            pointer-events: none;
            user-select: none;
        `;
        document.body.appendChild(span);
        // 添加更复杂的动画效果
        const animation = span.animate([
            { 
                transform: 'scale(0) rotate(0deg)', 
                opacity: 1,
                top: `${y - 20}px`
            },
            { 
                transform: 'scale(1.2) rotate(10deg)', 
                opacity: 1,
                top: `${y - 60}px`
            },
            { 
                transform: 'scale(1) rotate(-5deg)', 
                opacity: 0,
                top: `${y - 180}px`
            }
        ], {
            duration: 2000,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        });
        new Audio(audioList[audioIndex]).play();
        audioIndex = (audioIndex + 1) % audioList.length;
        animation.onfinish = () => {
            span.remove();
        }
    }

    useEffect(() => {
        document.body.addEventListener('click', cialloAppend)

        return () => {
            document.body.removeEventListener('click', cialloAppend)
        }
    })

    return (
        <div style={{
            background: 'linear-gradient(45deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
            minHeight: '100vh',
            width: '100vw',
            position: 'fixed',
            top: 0,
            left: 0,
            overflow: 'hidden'
        }}>
            <Jumper />
            <div>
                {colorMap.map((item, index) => <Ciallo key={index} {...item} />)}
            </div>
            <footer style={{
                position: 'fixed',
                bottom: '10px',
                right: '15px',
                fontSize: '12px',
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
