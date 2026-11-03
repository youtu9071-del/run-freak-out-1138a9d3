import { useRef, useState } from 'react';
import { Camera, Eye, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { compressProfilePhoto, ownedAvatarPath } from '@/lib/profilePhoto';

export default function ProfilePhoto() {
  const { user, profile, refreshProfile } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user || locked.current) return;
    locked.current = true; setBusy(true);
    let uploadedPath: string | null = null;
    try {
      const blob = await compressProfilePhoto(file);
      const extension = blob.type === 'image/webp' ? 'webp' : 'png';
      const path = `${user.id}/avatar-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
      if (error) throw error;
      uploadedPath = path;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('user_id', user.id);
      if (updateError) throw updateError;
      uploadedPath = null;
      const previous = ownedAvatarPath(profile?.avatar_url, user.id);
      if (previous) {
        const { error: cleanupError } = await supabase.storage.from('avatars').remove([previous]);
        if (cleanupError) toast.warning('Photo enregistrée, mais l’ancienne photo n’a pas pu être supprimée.');
      }
      await refreshProfile();
      toast.success('Photo de profil mise à jour');
    } catch {
      if (uploadedPath) await supabase.storage.from('avatars').remove([uploadedPath]);
      toast.error('Impossible d’enregistrer la photo. Essayez une image JPEG, PNG ou WebP.');
    } finally { locked.current = false; setBusy(false); }
  };

  const remove = async () => {
    if (!user || locked.current) return;
    locked.current = true; setBusy(true);
    try {
      const previous = ownedAvatarPath(profile?.avatar_url, user.id);
      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('user_id', user.id);
      if (error) throw error;
      await refreshProfile();
      setConfirmDelete(false);
      if (previous) {
        const { error: cleanupError } = await supabase.storage.from('avatars').remove([previous]);
        if (cleanupError) { toast.warning('Photo retirée du profil, mais sa suppression du stockage a échoué.'); return; }
      }
      toast.success('Photo de profil supprimée');
    } catch { toast.error('Impossible de supprimer la photo. Réessayez.'); }
    finally { locked.current = false; setBusy(false); }
  };

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" disabled={busy} aria-label="Gérer ma photo de profil" className="relative h-20 w-20 p-0 rounded-2xl neon-glow shrink-0 overflow-hidden group">
          <Avatar className="h-full w-full rounded-2xl">
            <AvatarImage src={profile?.avatar_url || undefined} alt="Ma photo de profil" className="object-cover" />
            <AvatarFallback className="rounded-2xl gradient-primary font-display font-black text-3xl text-primary-foreground">{(profile?.username || 'R')[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 rounded-tl-md bg-background/80 p-1 text-primary">{busy ? <Loader2 className="animate-spin" /> : <Camera />}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-2">
        <DropdownMenuItem disabled={!profile?.avatar_url} onSelect={() => setView(true)} className="gap-3 py-3"><Eye className="h-4 w-4" />Voir la photo</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => input.current?.click()} className="gap-3 py-3"><ImagePlus className="h-4 w-4" />Importer une photo</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!profile?.avatar_url} onSelect={() => setConfirmDelete(true)} className="gap-3 py-3 text-destructive focus:bg-destructive/10 focus:text-destructive"><Trash2 className="h-4 w-4" />Supprimer la photo</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <input ref={input} type="file" accept="image/*" aria-label="Importer une photo de profil" onChange={upload} className="hidden" />
    <Dialog open={view} onOpenChange={setView}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-lg" aria-describedby={undefined}>
        <DialogTitle>Ma photo de profil</DialogTitle>
        <img src={profile?.avatar_url || undefined} alt="Ma photo de profil agrandie" className="w-full max-h-[70dvh] object-contain rounded-md" />
      </DialogContent>
    </Dialog>
    <Dialog open={confirmDelete} onOpenChange={open => { if (!busy) setConfirmDelete(open); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-lg">
        <DialogTitle>Supprimer la photo ?</DialogTitle>
        <DialogDescription>Votre photo sera retirée du profil et du stockage.</DialogDescription>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setConfirmDelete(false)}>Annuler</Button>
          <Button variant="destructive" disabled={busy} onClick={remove}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}Supprimer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}