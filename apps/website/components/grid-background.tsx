
export function GridBackgroundDemo({children}:{children:React.ReactNode}) {
    return (
      <div className="h-[30rem] w-full bg-black  bg-grid-white/[0.2] relative flex items-center justify-center">
        {/* Radial gradient for the container to give a faded look */}
        <div className="absolute pointer-events-none inset-0 flex items-center justify-center bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_5%,black)]"></div>
        <div className="text-4xl sm:text-7xl  relative z-20 bg-clip-text text-transparent bg-gradient-to-b from-neutral-200 to-neutral-500 py-8">
        {children}
        </div>
      </div>
    );
  }