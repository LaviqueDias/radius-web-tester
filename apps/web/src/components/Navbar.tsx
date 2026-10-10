import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Radio, Server, Send, History, Bookmark, LogOut, ShieldCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: Radio },
    { to: '/builder', label: 'Packet Builder', icon: Send },
    { to: '/servers', label: 'Servidores RADIUS', icon: Server },
    { to: '/history', label: 'Histórico', icon: History },
    { to: '/templates', label: 'Modelos', icon: Bookmark },
  ];

  return (
    <nav className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 text-white font-bold text-lg tracking-tight">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <span>RADIUS Web Tester</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2.5 text-sm">
                <div className="text-right hidden sm:block">
                  <div className="font-medium text-slate-200">{user.username}</div>
                  <div className="text-xs text-slate-400 flex items-center justify-end gap-1">
                    {user.role === 'admin' ? (
                      <span className="text-blue-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Admin
                      </span>
                    ) : (
                      'Operador'
                    )}
                  </div>
                </div>

                <button
                  onClick={logout}
                  title="Sair da conta"
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
