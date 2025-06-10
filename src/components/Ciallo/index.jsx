import React from "react";
import "./index.css";




const Ciallo = ({ dur = 20, color = 'red', size = "15px", top = "0px" }) => {
    return (
        <p className="ciallo" style={{ 
            animationDuration: `${dur}s`, 
            color: color, 
            fontSize: size,
            top: top
        }} >
            Ciallo～(∠・ω&lt; )⌒★
        </p>
    )
}

export default Ciallo;