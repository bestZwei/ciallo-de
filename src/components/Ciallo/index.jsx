import React, { useEffect, useRef } from "react";
import "./index.css";

const Ciallo = ({ dur = 20, color = 'red', size = "15px", top = "0px", lane = 0, speedTier = 'medium' }) => {
    const elementRef = useRef(null);
    
    // Speed tier definitions (fixed speeds)
    const speedTiers = {
        slow: 25,    // 25 seconds (slow)
        medium: 18,  // 18 seconds (medium)
        fast: 12,    // 12 seconds (fast)
        variable: dur // Use original duration for variable speed
    };
    
    // Enhanced lane management with collision detection
    const laneHeight = window.innerHeight / 8; // Assume 8 total lanes
    const baseLaneTop = lane * laneHeight;
    const laneOffset = Math.random() * (laneHeight * 0.6) + (laneHeight * 0.2); // Random position within lane bounds
    const adjustedTop = `${baseLaneTop + laneOffset}px`;
    
    // Apply speed based on tier
    let finalDuration;
    let speedVariation = 1;
    
    if (speedTier === 'variable') {
        // Only variable tier gets speed variation (minority of barrages)
        speedVariation = 0.8 + Math.random() * 0.4; // 0.8x to 1.2x speed
        finalDuration = speedTiers[speedTier] / speedVariation;
    } else {
        // Fixed speed tiers (majority of barrages)
        finalDuration = speedTiers[speedTier];
    }
    
    const startDelay = Math.random() * 3;
    
    // Add slight vertical drift to make movement more interesting
    const verticalDrift = (Math.random() - 0.5) * 20; // Up to 20px drift
    
    useEffect(() => {
        if (elementRef.current) {
            // Apply dynamic custom properties for animation
            elementRef.current.style.setProperty('--vertical-drift', `${verticalDrift}px`);
            elementRef.current.style.setProperty('--lane-id', lane);
        }
    }, [verticalDrift, lane]);
    
    return (
        <p 
            ref={elementRef}
            className="ciallo" 
            style={{ 
                animationDuration: `${finalDuration}s`, 
                animationDelay: `${startDelay}s`,
                color: color, 
                fontSize: size,
                top: adjustedTop,
                zIndex: 500 - lane, // Ensure all lanes are below Jumper component (z-index 2000)
                '--speed-variation': speedVariation,
                '--speed-tier': speedTier,
            }} 
        >
            Ciallo～(∠・ω&lt; )⌒★
        </p>
    )
}

export default Ciallo;