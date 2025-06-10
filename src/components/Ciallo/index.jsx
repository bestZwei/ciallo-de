import React from "react";
import "./index.css";




const Ciallo = ({ dur = 20, color = 'red', size = "15px", top = "0px", shadow = '1px 1px 2px rgba(0,0,0,0.2)', delay = 0 }) => {
    return (
        <p className="ciallo" style={{ 
            animationDuration: `${dur}s`, 
            animationDelay: `${delay}s`,
            color: color, 
            fontSize: size,
            top: typeof top === 'number' ? `${top}px` : top,
            textShadow: shadow
        }} >
            Ciallo～(∠・ω&lt; )⌒★
        </p>
    )
}

export default Ciallo;