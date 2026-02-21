import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
}

export const Button = ({ children, variant = 'primary', className = '', ...props }: ButtonProps) => {
    const baseStyle = "px-4 py-2 rounded-md font-medium transition-colors shadow-sm animate-fade-in focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900";

    // To map to our CSS variables exactly, we can use style directly for the primary/danger variants or let Tailwind handle if we were using it.
    // Since we use Vanilla CSS variables, we'll apply them here.

    const customStyle: React.CSSProperties = {};
    if (variant === 'primary') {
        customStyle.backgroundColor = 'var(--accent-primary)';
        customStyle.color = 'var(--text-primary)';
    } else if (variant === 'danger') {
        customStyle.backgroundColor = 'var(--danger)';
        customStyle.color = 'var(--text-primary)';
    } else {
        customStyle.backgroundColor = 'var(--bg-tertiary)';
        customStyle.color = 'var(--text-primary)';
        customStyle.borderColor = 'var(--border-color)';
    }

    return (
        <button className={`${baseStyle} ${className}`} style={customStyle} {...props}>
            {children}
        </button>
    );
};
