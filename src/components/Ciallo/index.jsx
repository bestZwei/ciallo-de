import React from "react";
import "./index.css";




const Ciallo = ({ dur = 20, color = 'red', size = "15px", top = "0px", lane = 0 }) => {
    // Add slight vertical offset based on lane to prevent overlap
    const laneOffset = (lane % 4) * 3;
    const adjustedTop = `calc(${top} + ${laneOffset}px)`;
    
    // Vary the starting position slightly
    const startDelay = Math.random() * 2;
    
    return (
        <p className="ciallo" style={{ 
            animationDuration: `${dur}s`, 
            animationDelay: `${startDelay}s`,
            color: color, 
            fontSize: size,
            top: adjustedTop,
            zIndex: 100 - lane // Higher lanes appear behind lower ones
        }} >
            Ciallo～(∠・ω&lt; )⌒★
        </p>
    )
}

export default Ciallo;