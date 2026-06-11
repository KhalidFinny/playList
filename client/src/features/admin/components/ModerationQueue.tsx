import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListMusic, X, Check, Loader2, Play, Headphones } from 'lucide-react';
import { Button } from '@/shared/components/button';
import { Card } from '@/shared/components/card';
import { Input } from '@/shared/components/input';
import { PreviewAudioPlayer } from './PreviewAudioPlayer';
import { useAudioOutput } from '@/shared/hooks/useAudioOutput';

import type { ModerationQueueProps } from '../types';

export function ModerationQueue({
  pendingQueue,
  processingId,
  editingId,
  editValue,
  setEditValue,
  handleApprove,
  handleDelete,
  handleSaveEdit,
  onPreviewChange,
}: ModerationQueueProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { devices, selectedDeviceId, selectDevice, supportsSetSinkId, isCustomDevice } = useAudioOutput();

  // Notify parent when preview state changes (to mute main player)
  const togglePreview = (youtubeId: string | null) => {
    const nextId = previewId === youtubeId ? null : youtubeId;
    setPreviewId(nextId);
    onPreviewChange(nextId);
  };

  return (
    <section className="flex flex-col gap-6 sm:gap-10 w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 sm:px-8 py-2">
          <div className="flex flex-col gap-0.5">
            <h4 className="text-base sm:text-lg font-bold text-black tracking-tight">Pending Requests</h4>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-orange-500/80 rounded-full" />
              <p className="text-[10px] sm:text-[11px] font-medium text-black/40 uppercase tracking-widest leading-none">Songs to approve</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Audio Output Device Selector */}
            {devices.length > 0 && supportsSetSinkId && (
              <div className="relative group flex-1 sm:flex-none">
                <select
                  value={selectedDeviceId}
                  onChange={(e) => selectDevice(e.target.value)}
                  className="appearance-none bg-black/5 text-black/50 px-3 sm:px-4 py-2 rounded-full font-bold text-[10px] sm:text-[11px] tracking-widest border border-black/5 cursor-pointer hover:border-black/20 transition-colors outline-none pr-7 sm:pr-8 w-full sm:w-auto truncate max-w-[160px] sm:max-w-none"
                  title="Preview audio output device"
                >
                  <option value="default">🔊 Default Speaker</option>
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <Headphones size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 pointer-events-none" />
              </div>
            )}
            <div className="bg-black/5 text-black/50 px-3 sm:px-5 py-2 rounded-full font-bold text-[10px] sm:text-[12px] tracking-widest border border-black/5 shrink-0">
              {pendingQueue.length.toString().padStart(2, '0')} WAITING
            </div>
          </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 sm:py-4 px-2">
          <AnimatePresence>
            {pendingQueue.map((song, index) => (
              <motion.article 
                key={song.id} 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }}
              >
                <Card variant="premium-list" className="p-3 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
                  {/* Top row: index + info on mobile, index + thumb + info + actions on desktop */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* index */}
                    <span className="text-[10px] font-bold text-black/10 w-4 shrink-0">{(index + 1).toString().padStart(2, '0')}</span>

                    {/* thumb */}
                    <div className="relative w-12 h-12 sm:w-16 sm:h-16 shrink-0 overflow-hidden bg-black/5 rounded-lg sm:rounded-xl group">
                      <img src={`https://img.youtube.com/vi/${song.youtubeId}/mqdefault.jpg`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => togglePreview(song.youtubeId)}
                          className="text-white hover:bg-white/20 bg-black/20 backdrop-blur-sm w-7 h-7 sm:w-10 sm:h-10"
                        >
                          {previewId === song.youtubeId ? <X size={16} /> : <Play className="fill-current" size={16} />}
                        </Button>
                      </div>
                    </div>
                    
                    {/* info */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      {editingId === song.id ? (
                        <div className="flex gap-2">
                          <Input 
                            value={editValue} 
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                            className="h-10 bg-black/5 border-none rounded-lg text-sm font-bold text-black"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" onClick={() => handleSaveEdit(song.id)} className="h-10 w-10 text-green-600">
                            <Check size={20} />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <h5 className="text-[12px] sm:text-[15px] font-bold text-black tracking-normal truncate leading-tight font-poppins">{song.title}</h5>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                             <span className="text-[9px] sm:text-[10px] font-bold text-black/30 uppercase tracking-widest">{song.author}</span>
                             <div className="w-1 h-1 rounded-full bg-black/10" />
                             <span className="text-[9px] sm:text-[10px] font-medium text-orange-500/50 uppercase">by {song.submittedBy.slice(0, 6)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions — pinned to right */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-center sm:ml-auto mt-0 sm:mt-0">
                     <Button 
                       size="icon"
                       variant="outline"
                       onClick={() => togglePreview(song.youtubeId)}
                       className={`h-9 w-9 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl hover:scale-110 transition-transform active:scale-90 border border-black/10 ${previewId === song.youtubeId ? 'bg-orange-500/10 border-orange-500/30 text-orange-500' : 'text-black/40 hover:text-orange-500'}`}
                       title="Preview this song before approving"
                     >
                       {previewId === song.youtubeId ? <X size={18} /> : <Play className="fill-current" size={18} />}
                     </Button>
                     <Button 
                       size="icon"
                       onClick={() => handleApprove(song.id)} 
                       disabled={processingId === song.id}
                       variant="premium-success"
                       className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl hover:scale-110 transition-transform active:scale-90"
                     >
                       {processingId === song.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={20} strokeWidth={3} />}
                     </Button>
                     <Button 
                       size="icon" 
                       variant="premium-danger" 
                       onClick={() => handleDelete(song.id)} 
                       className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl hover:scale-110 transition-transform active:scale-90"
                     >
                       <X size={20} strokeWidth={3} />
                     </Button>
                  </div>
                </Card>

                {/* VISIBLE PREVIEW PLAYER - Routes audio to selected device */}
                <AnimatePresence>
                  {previewId === song.youtubeId && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/5 rounded-2xl mt-2 p-4"
                    >
                      <PreviewAudioPlayer
                        youtubeId={song.youtubeId}
                        isActive={true}
                        deviceId={isCustomDevice ? selectedDeviceId : 'default'}
                        title={song.title}
                        author={song.author}
                      />
                      <p className="text-[10px] font-bold text-center mt-2 text-black/20 uppercase tracking-widest">
                        Private preview — {isCustomDevice ? 'routed to selected device' : 'plays through default speakers'}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            ))}
          </AnimatePresence>

          {pendingQueue.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center bg-black/1 border-2 border-dashed border-black/5 rounded-4xl m-4">
              <ListMusic size={40} className="text-black/5 mb-4" />
              <p className="text-[11px] font-bold tracking-widest text-black/20 uppercase">Your queue is empty</p>
            </div>
          ) : null}
      </div>
    </section>
  );
}
