import React from 'react';

export const Card = ({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => {
    return (
        <div
            onClick={onClick}
            className={`bg-zinc-800 rounded-lg p-4 shadow-md border animate-fade-in ${onClick ? 'cursor-pointer hover:border-blue-500 transition-colors' : 'border-zinc-700'} ${className}`}
            style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
            }}
        >
            {children}
        </div>
    );
};
