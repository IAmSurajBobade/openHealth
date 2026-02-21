import React from 'react';

export const Card = ({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => {
    return (
        <div
            onClick={onClick}
            className={`premium-card p-4 animate-fade-in ${onClick ? 'cursor-pointer' : ''} ${className}`}
        >
            {children}
        </div>
    );
};
