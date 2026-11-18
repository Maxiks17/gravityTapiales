import './Card.css';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

export const Card = ({ children, className = '', style }: CardProps) => {
    return (
        <div className={`card ${className}`} style={style}>
            {children}
        </div>
    );
};

interface CardHeaderProps {
    children: React.ReactNode;
    className?: string;
}

export const CardHeader = ({ children, className = '' }: CardHeaderProps) => {
    return (
        <div className={`card-header ${className}`}>
            {children}
        </div>
    );
};

interface CardTitleProps {
    children: React.ReactNode;
    className?: string;
}

export const CardTitle = ({ children, className = '' }: CardTitleProps) => {
    return (
        <h3 className={`card-title ${className}`}>
            {children}
        </h3>
    );
};

interface CardContentProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

export const CardContent = ({ children, className = '', style }: CardContentProps) => {
    return (
        <div className={`card-content ${className}`} style={style}>
            {children}
        </div>
    );
};
