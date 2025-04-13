interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
}

function LoadingSpinner({ size = 'medium' }: LoadingSpinnerProps) {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12'
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`animate-spin rounded-full border-2 border-gray-200 border-t-blue-500 ${sizeClasses[size]}`}
      />
    </div>
  );
}

export default LoadingSpinner;