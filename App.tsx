import React, { useState, useEffect } from 'react';
import { Film, Download, Trash2, Plus, LogIn, LogOut, X, Search, MessageSquarePlus, MessageSquare, Loader2, Eye, EyeOff, Key } from 'lucide-react';
import type { Movie, MovieRequest } from './types';

export default function App() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [requests, setRequests] = useState<MovieRequest[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showAdminRequests, setShowAdminRequests] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingMovieId, setDeletingMovieId] = useState<string | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  
  // Passcode management states
  const [showChangePasscodeModal, setShowChangePasscodeModal] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [masterError, setMasterError] = useState<string | null>(null);
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [showNewPasscode, setShowNewPasscode] = useState(false);
  const [showAdminPasscodeEye, setShowAdminPasscodeEye] = useState(false);
  
  // New request state
  const [requestTitle, setRequestTitle] = useState('');

  // Form states
  const [newMovie, setNewMovie] = useState({
    title: '',
    description: '',
    imageUrl: '',
    downloadUrl: ''
  });
  const [uploadType, setUploadType] = useState<'link' | 'file'>('link');
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  useEffect(() => {
    fetchMovies();
    fetchRequests();
    // Check if previously logged in
    const savedPasscode = localStorage.getItem('cinema_admin_passcode');
    if (savedPasscode) {
      fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ passcode: savedPasscode })
      })
      .then(res => {
        if (res.ok) {
          setAdminPasscode(savedPasscode);
          setIsAdmin(true);
        } else {
          localStorage.removeItem('cinema_admin_passcode');
        }
      })
      .catch(() => {
        // Safe fallback - keep offline login but don't force logout on network error
        setAdminPasscode(savedPasscode);
        setIsAdmin(true);
      });
    }
  }, []);

  const fetchMovies = async () => {
    try {
      const res = await fetch('/api/movies');
      const data = await res.json();
      setMovies(data);
    } catch (error) {
      console.error('Failed to fetch movies', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Failed to fetch requests', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!adminPasscode) {
      setLoginError('wrong passcode');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ passcode: adminPasscode })
      });
      if (res.ok) {
        localStorage.setItem('cinema_admin_passcode', adminPasscode);
        setIsAdmin(true);
        setShowLogin(false);
        setLoginError(null);
      } else {
        setLoginError('wrong passcode');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
      }
    } catch (error) {
      console.error('Failed to verify passcode', error);
      setLoginError('wrong passcode');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('cinema_admin_passcode');
    setIsAdmin(false);
    setAdminPasscode('');
  };

  const openLoginModal = () => {
    setLoginError(null);
    setAdminPasscode('');
    setShowAdminPasscodeEye(false);
    setShowLogin(true);
  };

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setMasterError(null);
    
    if (!masterPassword) {
      setMasterError('Master password is required');
      return;
    }
    if (!newPasscode) {
      setMasterError('New passcode is required');
      return;
    }

    try {
      const res = await fetch('/api/admin/change-passcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ masterPassword, newPasscode })
      });

      if (res.ok) {
        alert('Passcode changed successfully! Please log in again.');
        handleLogout();
        setShowChangePasscodeModal(false);
        setMasterPassword('');
        setNewPasscode('');
        setShowMasterPassword(false);
        setShowNewPasscode(false);
        setShowLogin(true);
      } else {
        const errorData = await res.json().catch(() => null);
        setMasterError(errorData?.error || 'Failed to update passcode');
      }
    } catch (error) {
      console.error('Failed to change passcode', error);
      setMasterError('Network error occurred.');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMovie.title.trim()) {
      alert('Movie Title is required.');
      return;
    }
    
    if (uploadType === 'file' && !selectedVideoFile) {
      alert('Please select a video file to upload.');
      return;
    }
    
    if (uploadType === 'link' && !newMovie.downloadUrl.trim()) {
      alert('Download Link is required.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let finalDownloadUrl = newMovie.downloadUrl;
      const isLocal = uploadType === 'file';

      if (isLocal && selectedVideoFile) {
        // Upload file via XHR to see real-time progress!
        finalDownloadUrl = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const formData = new FormData();
          formData.append('video', selectedVideoFile);

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(percent);
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const res = JSON.parse(xhr.responseText);
                if (res.fileUrl) {
                  resolve(res.fileUrl);
                } else {
                  reject(new Error('Invalid response.'));
                }
              } catch (err) {
                reject(new Error('Failed to parse response.'));
              }
            } else {
              try {
                const errJson = JSON.parse(xhr.responseText);
                reject(new Error(errJson.error || 'Upload failed'));
              } catch {
                reject(new Error(`Upload failed with status: ${xhr.status}`));
              }
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload.'));
          });

          xhr.open('POST', '/api/upload-video');
          xhr.setRequestHeader('x-admin-passcode', adminPasscode);
          xhr.send(formData);
        });
      }

      // Now create the movie in movies.json
      const res = await fetch('/api/movies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': adminPasscode
        },
        body: JSON.stringify({
          ...newMovie,
          downloadUrl: finalDownloadUrl,
          isLocalVideo: isLocal
        })
      });
      
      if (res.ok) {
        const addedMovie = await res.json();
        setMovies([addedMovie, ...movies]);
        setShowUpload(false);
        setNewMovie({ title: '', description: '', imageUrl: '', downloadUrl: '' });
        setSelectedVideoFile(null);
        setUploadProgress(0);
      } else {
        const errorData = await res.json().catch(() => null);
        alert(`Upload failed: ${errorData?.error || 'Please check your passcode.'}`);
        if (res.status === 401) handleLogout();
      }
    } catch (error: any) {
      console.error('Failed to upload movie', error);
      alert(`Error during upload: ${error?.message || error}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingMovieId(id);
    try {
      const res = await fetch(`/api/movies/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-passcode': adminPasscode
        }
      });
      
      if (res.ok) {
        setMovies(movies.filter(m => String(m.id) !== String(id)));
      } else {
        alert('Delete failed. Please check your passcode.');
        if (res.status === 401) handleLogout();
      }
    } catch (error) {
      console.error('Failed to delete movie', error);
    } finally {
      setDeletingMovieId(null);
    }
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTitle.trim()) return;
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: requestTitle })
      });
      
      if (res.ok) {
        const newReq = await res.json();
        setRequests([...requests, newReq]);
        setRequestTitle('');
        setShowRequestForm(false);
        alert('Your request has been submitted successfully!');
      }
    } catch (error) {
      console.error('Failed to submit request', error);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    setDeletingRequestId(id);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-passcode': adminPasscode
        }
      });
      
      if (res.ok) {
        setRequests(requests.filter(r => String(r.id) !== String(id)));
      } else {
        const errorData = await res.json().catch(() => null);
        alert(`Delete failed: ${errorData?.error || 'Please check your passcode.'}`);
        if (res.status === 401) handleLogout();
      }
    } catch (error) {
      console.error('Failed to delete request', error);
      alert('Network error occurred during request deletion.');
    } finally {
      setDeletingRequestId(null);
    }
  };

  const filteredMovies = movies.filter(m => 
    m.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#050505] text-[#f5f5f5] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0a0a0a] border-r border-[#1a1a1a] p-8 flex flex-col gap-10 flex-shrink-0 hidden md:flex">
        <div className="font-serif italic text-2xl tracking-widest text-[#d4af37]">CINEMACLUB</div>
        
        <nav className="flex flex-col gap-4">
          <div className="text-white text-sm border-l-2 border-[#d4af37] pl-4">Library</div>
          <div className="text-[#666] text-sm pl-4 cursor-pointer hover:text-white transition-colors">Featured</div>
          <div className="text-[#666] text-sm pl-4 cursor-pointer hover:text-white transition-colors">Collection</div>
        </nav>
        
        <div className="mt-8">
          <h4 className="text-[10px] uppercase tracking-widest text-[#888] mb-3 font-bold pl-4">Contact Us</h4>
          <a href="mailto:pramanikanik447@gmail.com" className="text-sm text-[#d4af37] hover:text-white pl-4 transition-colors break-all">
            pramanikanik447@gmail.com
          </a>
        </div>
        
        <div className="mt-auto">
          {isAdmin ? (
            <div className="bg-[#111111] border border-dashed border-[#333] p-5 rounded-lg">
              <h3 className="text-[10px] uppercase tracking-widest text-[#888] mb-4 font-bold">Admin Console</h3>
              <p className="text-xs text-[#888] mb-4 leading-relaxed">
                Authorized: Admin User<br/>
                Status: Direct Upload Active
              </p>
              <button 
                onClick={() => setShowUpload(true)}
                className="w-full bg-[#d4af37] text-black font-bold py-2.5 rounded text-xs uppercase mb-2 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Upload Movie
              </button>
              <button 
                onClick={() => setShowAdminRequests(true)}
                className="w-full bg-[#1a1a1a] text-white border border-[#333] font-bold py-2.5 rounded text-xs uppercase hover:bg-[#222] transition-colors flex items-center justify-center gap-2 relative mb-2"
              >
                <MessageSquare className="w-4 h-4" /> View Requests
                {requests.length > 0 && (
                  <span className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                    {requests.length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setShowChangePasscodeModal(true)}
                className="w-full bg-[#111] hover:bg-[#1a1a1a] text-[#aaa] hover:text-white border border-[#222] hover:border-[#444] font-bold py-2.5 rounded text-xs uppercase flex items-center justify-center gap-2"
              >
                <Key className="w-3.5 h-3.5" /> Passcode Setup
              </button>
              <button 
                onClick={handleLogout}
                className="w-full mt-2 text-xs text-[#888] hover:text-white py-2"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="bg-[#111111] border border-dashed border-[#333] p-5 rounded-lg">
               <h3 className="text-[10px] uppercase tracking-widest text-[#888] mb-4 font-bold">Menu</h3>
               <button 
                 onClick={() => setShowRequestForm(true)}
                 className="w-full bg-[#1a1a1a] text-white border border-[#333] hover:bg-[#222] font-bold py-2.5 rounded text-xs uppercase transition-colors mb-2 flex items-center justify-center gap-2"
               >
                 <MessageSquarePlus className="w-4 h-4" /> Request Movie
               </button>
               <button 
                 onClick={openLoginModal}
                 className="w-full bg-[#333] text-white hover:bg-[#444] font-bold py-2.5 rounded text-xs uppercase transition-colors"
               >
                 Admin Login
               </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 flex flex-col gap-8 overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex justify-between items-center mb-4">
          <div className="font-serif italic text-xl tracking-widest text-[#d4af37]">CINEMACLUB</div>
          {isAdmin ? (
            <div className="flex gap-4 items-center">
              <button 
                onClick={() => setShowChangePasscodeModal(true)} 
                className="text-xs text-[#d4af37] flex items-center gap-1"
              >
                <Key className="w-3 h-3" /> Passcode
              </button>
              <button onClick={handleLogout} className="text-xs text-[#888]">Logout</button>
            </div>
          ) : (
            <button onClick={openLoginModal} className="text-xs text-[#d4af37]">Admin Login</button>
          )}
        </div>

        {/* Mobile Admin Upload Button */}
        {isAdmin ? (
          <div className="md:hidden flex gap-2">
            <button 
              onClick={() => setShowUpload(true)}
              className="flex-1 bg-[#d4af37] text-black font-bold py-2.5 rounded text-xs uppercase flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Upload
            </button>
            <button 
              onClick={() => setShowAdminRequests(true)}
              className="flex-1 bg-[#1a1a1a] text-white border border-[#333] font-bold py-2.5 rounded text-xs uppercase hover:bg-[#222] transition-colors flex items-center justify-center gap-2 relative"
            >
              <MessageSquare className="w-4 h-4" /> Requests
              {requests.length > 0 && (
                <span className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                  {requests.length}
                </span>
              )}
            </button>
          </div>
        ) : (
          <div className="md:hidden">
            <button 
              onClick={() => setShowRequestForm(true)}
              className="w-full bg-[#1a1a1a] text-white border border-[#333] hover:bg-[#222] font-bold py-2.5 rounded text-xs uppercase transition-colors flex items-center justify-center gap-2"
            >
              <MessageSquarePlus className="w-4 h-4" /> Request a Movie
            </button>
          </div>
        )}

        {/* Hero Banner */}
        <div className="relative w-full h-[360px] md:h-[420px] rounded-2xl overflow-hidden flex-shrink-0 group border border-[#1a1a1a]">
          <div className="absolute inset-0 bg-[#0d0d0d]">
            <img 
              src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2925&auto=format&fit=crop" 
              alt="Cinema Banner" 
              className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[1.5s] ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent"></div>
          </div>
          <div className="relative h-full flex flex-col justify-end pb-10 md:pb-12 px-8 md:px-12 max-w-3xl z-10">
            <div className="flex flex-wrap gap-3 mb-5">
              <span className="text-[10px] uppercase tracking-widest text-black bg-[#d4af37] px-3 py-1.5 rounded font-bold flex items-center gap-1.5">
                <Film className="w-3 h-3" /> Made by Anik
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[#d4af37] border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-1.5 rounded flex items-center">
                Exclusive Collection
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl font-light text-white mb-4 leading-tight">
              Cinematic <span className="font-serif italic text-[#d4af37]">Masterpieces</span>
            </h2>
            <p className="text-[#aaa] text-sm md:text-base leading-relaxed max-w-2xl mb-6">
              Welcome to CinemaClub. A curated collection of the finest movies, available for direct download. Experience high-quality entertainment without limits, completely free.
            </p>
            <div className="flex gap-4">
              <div className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 px-6 py-3 rounded text-xs font-bold uppercase tracking-widest text-center">
                {movies.length} {movies.length === 1 ? 'Movie' : 'Movies'} Posted
              </div>
            </div>
          </div>
        </div>

        <header id="latest-releases" className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-[#1a1a1a] pb-6 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-light tracking-tight m-0 text-white">Latest Releases</h1>
            <p className="text-[#666] mt-2 text-sm">Curated cinema collection for viewers.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
              <input 
                type="text" 
                placeholder="Search movies..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#050505] border border-[#1a1a1a] rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-[#d4af37] text-white transition-colors"
              />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[#d4af37] border border-[#d4af37] px-3 py-1.5 rounded-full self-start sm:self-auto flex-shrink-0">
              {isAdmin ? 'Admin View Enabled' : 'Viewer Mode'}
            </div>
          </div>
        </header>
        
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4af37]"></div>
          </div>
        ) : filteredMovies.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center text-center">
             <Film className="w-16 h-16 text-[#1a1a1a] mb-4" />
             <h2 className="text-xl font-medium text-[#888]">No movies found</h2>
           </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMovies.map((movie, index) => (
              <div key={movie.id} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden flex flex-col">
                 <div className="h-48 bg-[#1a1a1a] relative flex items-center justify-center overflow-hidden group">
                   {movie.imageUrl ? (
                     <img src={movie.imageUrl} alt={movie.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                   ) : (
                     <div className="text-[#333] text-6xl font-black">
                       {String(index + 1).padStart(2, '0')}
                     </div>
                   )}
                   <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 pointer-events-none"></div>
                 </div>
                 <div className="p-5 flex-1 flex flex-col gap-3">
                   <h4 className="text-[1.1rem] font-medium m-0 truncate text-white">{movie.title}</h4>
                   <span className="text-xs text-[#666]">{new Date(movie.createdAt).getFullYear()} • Movie</span>
                   <div className="flex gap-2 mt-auto pt-2">
                     <a 
                       href={`/api/download/${movie.id}`}
                       target="_blank" rel="noopener noreferrer"
                       className="flex-1 bg-[#d4af37] hover:bg-[#b5952f] text-black text-center font-bold py-2.5 px-3 text-xs rounded transition-colors flex items-center justify-center gap-2"
                     >
                       <Download className="w-3.5 h-3.5" />
                       Download Movie
                     </a>
                     {isAdmin && (
                       <button onClick={() => handleDelete(movie.id)} disabled={deletingMovieId === movie.id} className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 py-2.5 px-4 rounded text-xs transition-colors flex items-center justify-center disabled:opacity-50" title="Delete">
                         {deletingMovieId === movie.id ? (
                           <Loader2 className="w-3.5 h-3.5 animate-spin" />
                         ) : (
                           <Trash2 className="w-3.5 h-3.5" />
                         )}
                       </button>
                     )}
                   </div>
                 </div>
              </div>
            ))}
          </div>
        )}
        
        <footer className="mt-auto pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-[#1a1a1a] pb-4">
          <div className="text-[10px] text-[#444] uppercase tracking-widest text-center sm:text-left">
            © {new Date().getFullYear()} Cinemaclub Exclusive • Professional Movie Repository Interface
          </div>
          <div className="text-[10px] text-[#d4af37] uppercase tracking-widest font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse"></span>
            Made by Anik
          </div>
          <div className="text-[10px] text-[#666] uppercase tracking-widest flex items-center gap-2">
            <span>Contact:</span>
            <a href="mailto:pramanikanik447@gmail.com" className="text-[#d4af37] hover:text-white transition-colors border-b border-[#d4af37]/30">
              pramanikanik447@gmail.com
            </a>
          </div>
        </footer>
      </main>

      {/* Admin Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-[#0d0d0d] border ${loginError ? 'border-red-500' : 'border-[#1a1a1a]'} rounded-xl p-8 w-full max-w-sm relative shadow-2xl transition-all duration-300 ${isShaking ? 'animate-shake' : ''}`}>
            <button 
              onClick={() => {
                setShowLogin(false);
                setLoginError(null);
                setAdminPasscode('');
              }}
              className="absolute top-4 right-4 text-[#666] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-light tracking-tight mb-6 flex items-center gap-2 text-white">
              <LogIn className={`w-5 h-5 ${loginError ? 'text-red-500' : 'text-[#d4af37]'}`} />
              Admin Access
            </h2>
            <form onSubmit={handleLogin}>
              <div className="mb-6">
                <label className={`block text-xs uppercase tracking-wider mb-2 ${loginError ? 'text-red-400' : 'text-[#888]'}`}>Passcode</label>
                <div className="relative">
                  <input 
                    type={showAdminPasscodeEye ? "text" : "password"} 
                    value={adminPasscode}
                    onChange={(e) => {
                      setAdminPasscode(e.target.value);
                      setLoginError(null);
                    }}
                    className={`w-full bg-[#050505] rounded pl-4 pr-10 py-3 text-white focus:outline-none transition-all text-sm ${
                      loginError 
                        ? 'border border-red-500 bg-red-950/10 text-red-200 placeholder-red-400 focus:border-red-500 animate-blink-red' 
                        : 'border border-[#1a1a1a] focus:border-[#d4af37]'
                    }`}
                    placeholder="Enter admin passcode"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowAdminPasscodeEye(!showAdminPasscodeEye)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#666] hover:text-white transition-colors"
                  >
                    {showAdminPasscodeEye ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {loginError && (
                  <p className="text-red-500 text-xs mt-2 uppercase tracking-widest font-semibold animate-pulse">
                    {loginError}
                  </p>
                )}
              </div>
              <button 
                type="submit"
                className={`w-full text-black font-bold py-3 rounded text-sm uppercase transition-colors ${loginError ? 'bg-red-500 hover:bg-red-600' : 'bg-[#d4af37] hover:bg-[#b5952f]'}`}
              >
                Access Dashboard
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Change Admin Passcode Modal */}
      {showChangePasscodeModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-8 w-full max-w-sm relative shadow-2xl">
            <button 
              onClick={() => {
                setShowChangePasscodeModal(false);
                setMasterPassword('');
                setNewPasscode('');
                setMasterError(null);
                setShowMasterPassword(false);
                setShowNewPasscode(false);
              }}
              className="absolute top-4 right-4 text-[#666] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-light tracking-tight mb-6 flex items-center gap-2 text-white">
              <Key className="w-5 h-5 text-[#d4af37]" />
              Passcode Setup
            </h2>
            <form onSubmit={handleChangePasscode}>
              <div className="mb-4">
                <label className="block text-xs uppercase tracking-wider text-[#888] mb-2">Master Password</label>
                <div className="relative">
                  <input 
                    type={showMasterPassword ? "text" : "password"} 
                    value={masterPassword}
                    onChange={(e) => {
                      setMasterPassword(e.target.value);
                      setMasterError(null);
                    }}
                    className="w-full bg-[#050505] border border-[#1a1a1a] rounded pl-4 pr-10 py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors text-sm"
                    placeholder="Enter master password"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowMasterPassword(!showMasterPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#666] hover:text-white transition-colors"
                  >
                    {showMasterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs uppercase tracking-wider text-[#888] mb-2">New Admin Passcode</label>
                <div className="relative">
                  <input 
                    type={showNewPasscode ? "text" : "password"} 
                    value={newPasscode}
                    onChange={(e) => {
                      setNewPasscode(e.target.value);
                      setMasterError(null);
                    }}
                    className="w-full bg-[#050505] border border-[#1a1a1a] rounded pl-4 pr-10 py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors text-sm"
                    placeholder="Enter new passcode"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowNewPasscode(!showNewPasscode)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#666] hover:text-white transition-colors"
                  >
                    {showNewPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {masterError && (
                <p className="text-red-500 text-xs mb-4 uppercase tracking-wider font-semibold animate-pulse">
                  {masterError}
                </p>
              )}

              <button 
                type="submit"
                className="w-full bg-[#d4af37] hover:bg-[#b5952f] text-black font-bold py-3 rounded text-sm uppercase transition-colors"
              >
                Change Passcode
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Upload Movie Modal */}
      {showUpload && isAdmin && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-8 w-full max-w-md relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowUpload(false)}
              className="absolute top-4 right-4 text-[#666] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-light tracking-tight mb-6 flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-[#d4af37]" />
              Add New Movie
            </h2>
            <form onSubmit={handleUpload} className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#888] mb-2">Movie Title *</label>
                <input 
                  type="text" 
                  value={newMovie.title}
                  onChange={(e) => setNewMovie({...newMovie, title: e.target.value})}
                  className="w-full bg-[#050505] border border-[#1a1a1a] rounded px-4 py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors text-sm"
                  placeholder="e.g. Inception"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#888] mb-2">Description (Optional)</label>
                <textarea 
                  value={newMovie.description}
                  onChange={(e) => setNewMovie({...newMovie, description: e.target.value})}
                  className="w-full bg-[#050505] border border-[#1a1a1a] rounded px-4 py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors text-sm h-24 resize-none"
                  placeholder="Brief synopsis..."
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#888] mb-2">Movie Poster (Optional)</label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setNewMovie({...newMovie, imageUrl: reader.result as string});
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full bg-[#050505] border border-[#1a1a1a] rounded px-3 py-2 text-white focus:outline-none focus:border-[#d4af37] transition-colors text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#333] file:text-white hover:file:bg-[#444] cursor-pointer"
                />
                {newMovie.imageUrl && (
                  <div className="mt-3 h-32 w-24 relative overflow-hidden rounded border border-[#1a1a1a]">
                    <img src={newMovie.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => setNewMovie({...newMovie, imageUrl: ''})}
                      className="absolute top-1 right-1 bg-black/80 text-white rounded-full p-1 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#888] mb-2">Movie Video Source *</label>
                <div className="flex gap-2 mb-3 bg-[#050505] p-1 rounded border border-[#1a1a1a]">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadType('link');
                      setSelectedVideoFile(null);
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded uppercase tracking-wider transition-colors ${
                      uploadType === 'link'
                        ? 'bg-[#d4af37] text-black'
                        : 'text-[#888] hover:text-white'
                    }`}
                  >
                    Provide Download Link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadType('file');
                      setNewMovie({...newMovie, downloadUrl: ''});
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded uppercase tracking-wider transition-colors ${
                      uploadType === 'file'
                        ? 'bg-[#d4af37] text-black'
                        : 'text-[#888] hover:text-white'
                    }`}
                  >
                    Upload Video File
                  </button>
                </div>

                {uploadType === 'link' ? (
                  <input 
                    type="text" 
                    value={newMovie.downloadUrl}
                    onChange={(e) => setNewMovie({...newMovie, downloadUrl: e.target.value})}
                    className="w-full bg-[#050505] border border-[#1a1a1a] rounded px-4 py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors text-sm"
                    placeholder="https://example.com/download..."
                  />
                ) : (
                  <div className="space-y-2">
                    <input 
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedVideoFile(file);
                        }
                      }}
                      className="w-full bg-[#050505] border border-[#1a1a1a] rounded px-3 py-2 text-white focus:outline-none focus:border-[#d4af37] transition-colors text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#333] file:text-white hover:file:bg-[#444] cursor-pointer"
                    />
                    {selectedVideoFile && (
                      <div className="text-xs text-[#d4af37] bg-[#d4af37]/5 border border-[#d4af37]/20 rounded p-2.5 flex flex-col gap-1.5">
                        <div className="flex justify-between font-medium">
                          <span className="truncate">Selected: {selectedVideoFile.name}</span>
                          <span className="flex-shrink-0">({(selectedVideoFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                        </div>
                        {isUploading && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] uppercase text-[#888]">
                              <span>Uploading to server...</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-[#222] h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-[#d4af37] h-full transition-all duration-300 rounded-full"
                                style={{ width: `${uploadProgress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={isUploading}
                  className="w-full bg-[#d4af37] text-black font-bold py-3 rounded text-sm uppercase transition-colors hover:bg-[#b5952f] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    'Publish Movie'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Form Modal */}
      {showRequestForm && !isAdmin && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-8 w-full max-w-sm relative shadow-2xl">
            <button 
              onClick={() => setShowRequestForm(false)}
              className="absolute top-4 right-4 text-[#666] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-light tracking-tight mb-6 flex items-center gap-2 text-white">
              <MessageSquarePlus className="w-5 h-5 text-[#d4af37]" />
              Request a Movie
            </h2>
            <form onSubmit={submitRequest}>
              <div className="mb-6">
                <label className="block text-xs uppercase tracking-wider text-[#888] mb-2">Movie Title</label>
                <input 
                  type="text" 
                  value={requestTitle}
                  onChange={(e) => setRequestTitle(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1a1a1a] rounded px-4 py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors text-sm"
                  placeholder="What movie do you want?"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-white text-black font-bold py-3 rounded text-sm uppercase transition-colors hover:bg-zinc-200"
              >
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Requests Modal */}
      {showAdminRequests && isAdmin && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-6 md:p-8 w-full max-w-2xl relative shadow-2xl max-h-[85vh] flex flex-col">
            <button 
              onClick={() => setShowAdminRequests(false)}
              className="absolute top-4 right-4 text-[#666] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-light tracking-tight mb-6 flex items-center gap-2 text-white border-b border-[#1a1a1a] pb-4">
              <MessageSquare className="w-5 h-5 text-[#d4af37]" />
              Movie Requests ({requests.length})
            </h2>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {requests.length === 0 ? (
                <div className="text-center text-[#666] py-10">No pending movie requests.</div>
              ) : (
                requests.map(req => (
                  <div key={req.id} className="bg-[#111] border border-[#222] rounded p-4 flex justify-between items-start gap-4 group hover:border-[#333] transition-colors">
                    <div className="flex-1">
                      <h4 className="text-white font-medium mb-1 flex items-center gap-2">
                        {req.title}
                      </h4>
                      <div className="text-[10px] text-[#666] uppercase tracking-wider flex items-center gap-2 flex-wrap mb-2">
                        <span>{new Date(req.createdAt).toLocaleDateString()} at {new Date(req.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2 mt-1">
                        <button 
                          onClick={() => handleDeleteRequest(req.id)}
                          disabled={deletingRequestId === req.id}
                          className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 p-1.5 rounded transition-all disabled:opacity-50"
                          title="Dismiss Request"
                        >
                          {deletingRequestId === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
