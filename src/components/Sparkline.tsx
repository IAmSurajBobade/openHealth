import React from 'react';

interface SparklineProps {
    data: number[];
    idealMin?: number;
    idealMax?: number;
    width?: number;
    height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({ data, idealMin, idealMax, width = 100, height = 30 }) => {
    if (!data || data.length === 0) return null;

    if (data.length === 1) {
        // Just a dot if only 1 data point
        const cx = width / 2;
        const cy = height / 2;
        return (
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                <circle cx={cx} cy={cy} r={3} fill={getGraphColor(data[0], idealMin, idealMax)} />
            </svg>
        );
    }

    const minVal = Math.min(...data, idealMin ?? Infinity);
    const maxVal = Math.max(...data, idealMax ?? -Infinity);

    // Add some padding to max/min
    const range = (maxVal - minVal) || 1;
    const padding = range * 0.1;
    const plotMin = minVal - padding;
    const plotMax = maxVal + padding;
    const plotRange = plotMax - plotMin;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d - plotMin) / plotRange) * height;
        return `${x},${y}`;
    }).join(' ');

    // Compute overall color based on the latest value (trend end)
    const latestValue = data[data.length - 1];
    const color = getGraphColor(latestValue, idealMin, idealMax);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            {/* Optional: Draw ideal range background if specified */}
            {idealMin !== undefined && idealMax !== undefined && (
                <rect
                    x="0"
                    y={height - ((idealMax - plotMin) / plotRange) * height}
                    width={width}
                    height={((idealMax - idealMin) / plotRange) * height}
                    fill="rgba(16, 185, 129, 0.1)"
                />
            )}
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
            {/* Draw dot for latest value */}
            <circle
                cx={width}
                cy={height - ((latestValue - plotMin) / plotRange) * height}
                r={3}
                fill={color}
            />
        </svg>
    );
};

// Helper: Determine color based on deviation
function getGraphColor(value: number, idealMin?: number, idealMax?: number) {
    if (idealMin === undefined && idealMax === undefined) return 'var(--accent-primary)'; // default blue

    if (idealMin !== undefined && idealMax !== undefined) {
        if (value >= idealMin && value <= idealMax) return 'var(--success)'; // Green
        return 'var(--danger)'; // Red (out of bounds)
    }

    // If only min is provided (e.g. want a higher number)
    if (idealMin !== undefined) return value >= idealMin ? 'var(--success)' : 'var(--danger)';

    // If only max is provided (e.g. want a lower number)
    if (idealMax !== undefined) return value <= idealMax ? 'var(--success)' : 'var(--danger)';

    return 'var(--accent-primary)';
}
