import type { LucideIcon } from 'lucide-react';
import './StatCard.css';

interface StatCardProps {
    title: string;
    value: string;
    icon: LucideIcon;
    trend?: {
        value: number;
        label: string;
        isPositive: boolean;
    };
    color?: 'primary' | 'success' | 'warning' | 'error';
    showToggle?: boolean;
    toggleIcon?: LucideIcon;
    onToggle?: () => void;
}

const StatCard = ({ title, value, icon: Icon, trend, color = 'primary', showToggle, toggleIcon: ToggleIcon, onToggle }: StatCardProps) => {
    return (
        <div className={`stat-card stat-card-${color}`}>
            <div className="stat-card-content">
                <div className="stat-card-header">
                    <span className="stat-card-title">{title}</span>
                    <div className="stat-card-icons">
                        <div className={`stat-card-icon stat-card-icon-${color}`}>
                            <Icon size={24} />
                        </div>
                        {showToggle && ToggleIcon && onToggle && (
                            <button
                                className="stat-card-toggle"
                                onClick={onToggle}
                                aria-label="Toggle visibility"
                            >
                                <ToggleIcon size={18} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="stat-card-value">{value}</div>

                {trend && (
                    <div className={`stat-card-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
                        <span>{trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
                        <span className="stat-card-trend-label">{trend.label}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
