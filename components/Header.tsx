export default function Header() {
  return (
    <header className="bg-gradient-to-r from-primary-800 to-primary-600 shadow-lg border-b border-primary-500/30">
      <div className="container mx-auto px-10 py-6 max-w-6xl">
        <div className="flex items-center space-x-4">
          <div className="text-3xl font-bold text-white tracking-wider">
            Teampo
          </div>
          <div className="hidden md:block h-8 w-px bg-primary-300/50"></div>
          <div className="hidden md:block text-primary-100 text-sm">
            Phy/Switch 在线技术支持
          </div>
        </div>
      </div>
    </header>
  )
}
