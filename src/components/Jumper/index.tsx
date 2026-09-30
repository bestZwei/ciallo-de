import './index.css';

interface JumperProps {
  text?: string;
  dur?: number;
}

const Jumper = ({ text = 'Ciallo～(∠・ω< )⌒★', dur = 1.0 }: JumperProps) => {
  const chars = [...text];
  const n = chars.length;

  return (
    <div className="box">
      {chars.map((item, index) => (
        <span key={index} style={{ animationDelay: `${(dur * index) / n}s` }}>
          {item}
        </span>
      ))}
    </div>
  );
};

export default Jumper;
