import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
}

export const Button = ({ children, variant = 'primary', className = '', ...props }: ButtonProps) => {
    const baseStyle = "px-4 py-2 rounded-md font-medium transition-colors shadow-sm animate-fade-in focus:outline-none";

    const customStyle: React.CSSProperties = {
        transition: 'all 0.2s ease',
        border: '1px solid transparent'
    };

    if (variant === 'primary') {
        customStyle.backgroundColor = 'var(--accent-primary)';
        customStyle.color = '#fff';
        customStyle.boxShadow = '0 2px 10px var(--accent-glow)';
    } else if (variant === 'danger') {
        customStyle.backgroundColor = 'var(--danger)';
        customStyle.color = '#fff';
    } else {
        customStyle.backgroundColor = 'var(--bg-tertiary)';
        customStyle.color = 'var(--text-primary)';
        customStyle.borderColor = 'var(--border-color)';
        customStyle.backdropFilter = 'blur(8px)';
    }

    // Hover states using a simple hack or classes: we rely on generic structural classes
    // We'll add dynamic hover scale via inline transform but CSS transition handles it well.

    return (
        <button className={`${baseStyle} ${className}`} style={customStyle} {...props}>
            {children}
        </button>
    );
};
