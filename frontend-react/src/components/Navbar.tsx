import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="bg-green-700 text-white p-4 shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">🥚 EggTrack AI</h1>
        <div className="space-x-4">
          <Link to="/worker" className="hover:bg-green-600 px-3 py-2 rounded transition">Worker</Link>
          <Link to="/buyer" className="hover:bg-green-600 px-3 py-2 rounded transition">Buyer</Link>
          <Link to="/delivery" className="hover:bg-green-600 px-3 py-2 rounded transition">Delivery</Link>
          <Link to="/admin" className="hover:bg-green-600 px-3 py-2 rounded transition">Admin</Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;