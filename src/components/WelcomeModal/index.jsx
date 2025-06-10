import React from 'react';
import './index.css';

const WelcomeModal = ({ onClose }) => {
    return (
        <div className="welcome-modal-overlay">
            <div className="welcome-modal">
                <div className="welcome-header">
                    <div className="sparkle sparkle-1">✨</div>
                    <div className="sparkle sparkle-2">⭐</div>
                    <div className="sparkle sparkle-3">💫</div>
                    <h1 className="welcome-title">
                        Ciallo～(∠・ω&lt; )⌒★
                    </h1>
                </div>
                
                <div className="welcome-content">
                    <div className="welcome-avatar">
                        <div className="avatar-face">
                            <div className="avatar-eyes">
                                <div className="eye left-eye">
                                    <div className="pupil"></div>
                                </div>
                                <div className="eye right-eye">
                                    <div className="pupil"></div>
                                </div>
                            </div>
                            <div className="avatar-mouth">ω</div>
                        </div>
                    </div>
                    
                    <p className="welcome-text">
                        Ciallo～(∠・ω&lt; )⌒★⌒(｡･ω･｡)ﾉ♡ Ciallo~<br/>
                        <span className="welcome-subtitle">点击任意地方都会有惊喜哦～</span>
                    </p>
                </div>
                
                <button className="welcome-button" onClick={onClose}>
                    <span className="button-text">Ciallo！</span>
                    <div className="button-sparkle">✨</div>
                </button>
                
                <div className="welcome-footer">
                    <small>💡 提示：移动设备请允许音频播放以获得最佳体验</small>
                </div>
            </div>
        </div>
    );
};

export default WelcomeModal;
