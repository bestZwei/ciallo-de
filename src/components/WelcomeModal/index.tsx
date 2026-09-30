import './index.css';

interface WelcomeModalProps {
  onClose: () => void;
}

const WelcomeModal = ({ onClose }: WelcomeModalProps) => {
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
            Ciallo～(∠・ω&lt; )⌒★⌒(｡･ω･｡)ﾉ♡ <br />
            <span className="welcome-subtitle">Tap anywhere for a surprise~</span>
          </p>
        </div>

        <button className="welcome-button" onClick={onClose}>
          <span className="button-text">Ciallo!</span>
          <div className="button-sparkle">✨</div>
        </button>

        <div className="welcome-footer">
          <small>💡 Tip: Allow audio playback on mobile for the best experience</small>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
