import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  FolderOpen,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DrivePhoto } from '../types';
import { DriveFolderPickerModal, DriveFolderSelectionResult } from './DriveFolderPickerModal';
import { getGoogleDriveAccessToken } from '../services/supabaseAuth';
import { downloadDriveFileBlob } from '../services/drive';
import {
  PortfolioPost,
  portfolioAdminRequest,
  uploadPortfolioImages,
} from '../services/portfolioService';

const EVENT_TYPES = [
  'Wedding',
  'Holud',
  'Reception',
  'Pre-Wedding',
  'Engagement',
  'Couple',
  'Birthday',
  'Corporate',
  'Family',
  'Other',
];

type Draft = {
  id?: string;
  title: string;
  story: string;
  event_type: string;
  is_featured: boolean;
  is_published: boolean;
};

const emptyDraft: Draft = {
  title: '',
  story: '',
  event_type: 'Wedding',
  is_featured: false,
  is_published: false,
};

export default function PortfolioManager({ adminToken }: { adminToken: string }) {
  const [posts, setPosts] = useState<PortfolioPost[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedDrivePhotos, setSelectedDrivePhotos] = useState<DrivePhoto[]>([]);
  const [driveAccessToken, setDriveAccessToken] = useState('');
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [drivePickerTargetPostId, setDrivePickerTargetPostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);

  const publishedCount = useMemo(() => posts.filter((p) => p.is_published).length, [posts]);
  const featuredCount = useMemo(() => posts.filter((p) => p.is_featured && p.is_published).length, [posts]);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const result = await portfolioAdminRequest(adminToken, { action: 'list' });
      setPosts((result.posts || []) as PortfolioPost[]);
    } catch (error: any) {
      setMessage(error?.message || 'Could not load portfolio posts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [adminToken]);

  function newPost() {
    setDraft(emptyDraft);
    setSelectedFiles([]);
    setSelectedDrivePhotos([]);
    setEditorOpen(true);
    setMessage('');
  }

  function editPost(post: PortfolioPost) {
    setDraft({
      id: post.id,
      title: post.title,
      story: post.story || '',
      event_type: post.event_type || 'Wedding',
      is_featured: Boolean(post.is_featured),
      is_published: Boolean(post.is_published),
    });
    setSelectedFiles([]);
    setSelectedDrivePhotos([]);
    setEditorOpen(true);
    setMessage('');
  }

  async function savePost() {
    if (!draft.title.trim()) {
      setMessage('Post title is required.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const payload = {
        action: draft.id ? 'update' : 'create',
        id: draft.id,
        title: draft.title.trim(),
        story: draft.story.trim(),
        event_type: draft.event_type,
        is_featured: draft.is_featured,
        is_published: draft.is_published,
      };

      const result = await portfolioAdminRequest(adminToken, payload);
      const postId = draft.id || result.post?.id;

      if (!postId) throw new Error('Portfolio post could not be saved.');
      // Keep the created ID in the editor so a failed media transfer can be retried safely.
      setDraft((current) => ({ ...current, id: postId }));

      if (selectedFiles.length > 0) {
        await uploadPortfolioImages({
          adminToken,
          postId,
          files: selectedFiles,
          makeCover: true,
        });
      }
      if (selectedDrivePhotos.length > 0 && driveAccessToken) {
        await importDrivePhotos(selectedDrivePhotos, driveAccessToken, postId, true);
      }

      setMessage(draft.id ? 'Portfolio post updated.' : 'Portfolio post created.');
      setEditorOpen(false);
      setDraft(emptyDraft);
      setSelectedFiles([]);
      setSelectedDrivePhotos([]);
      await load();
    } catch (error: any) {
      setMessage(error?.message || 'Could not save portfolio post.');
    } finally {
      setLoading(false);
    }
  }

  async function patchPost(post: PortfolioPost, patch: Partial<PortfolioPost>) {
    setLoading(true);
    setMessage('');
    try {
      await portfolioAdminRequest(adminToken, {
        action: 'update',
        id: post.id,
        ...patch,
      });
      await load();
    } catch (error: any) {
      setMessage(error?.message || 'Could not update portfolio post.');
    } finally {
      setLoading(false);
    }
  }

  async function deletePost(post: PortfolioPost) {
    if (!window.confirm(`Delete “${post.title}” and its uploaded portfolio images?`)) return;

    setLoading(true);
    setMessage('');
    try {
      await portfolioAdminRequest(adminToken, { action: 'delete', id: post.id });
      setMessage('Portfolio post deleted.');
      await load();
    } catch (error: any) {
      setMessage(error?.message || 'Could not delete portfolio post.');
    } finally {
      setLoading(false);
    }
  }

  async function setCover(postId: string, mediaId: string) {
    setLoading(true);
    setMessage('');
    try {
      await portfolioAdminRequest(adminToken, {
        action: 'set_cover',
        post_id: postId,
        media_id: mediaId,
      });
      setMessage('Cover photo updated.');
      await load();
    } catch (error: any) {
      setMessage(error?.message || 'Could not update cover photo.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteMedia(mediaId: string) {
    if (!window.confirm('Delete this photo from the portfolio post?')) return;

    setLoading(true);
    setMessage('');
    try {
      await portfolioAdminRequest(adminToken, {
        action: 'delete_media',
        media_id: mediaId,
      });
      setMessage('Photo deleted.');
      await load();
    } catch (error: any) {
      setMessage(error?.message || 'Could not delete photo.');
    } finally {
      setLoading(false);
    }
  }

  function openDrivePicker(postId: string | null = null) {
    const token = getGoogleDriveAccessToken();
    if (!token) {
      setMessage('Google Drive is not connected. Reconnect Google Drive in the admin panel, then try again.');
      return;
    }
    setDriveAccessToken(token);
    setDrivePickerTargetPostId(postId);
    setDrivePickerOpen(true);
    setMessage('');
  }

  async function importDrivePhotos(photos: DrivePhoto[], token: string, postId: string, makeCover: boolean) {
    const supported = photos.filter((photo) =>
      ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(photo.mimeType)
    );
    if (!supported.length) {
      setMessage('No supported photos were found in that Drive folder.');
      return;
    }

    setLoading(true);
    setMessage(`Importing 0 of ${supported.length} Drive photos…`);
    try {
      let uploadedCount = 0;
      for (let start = 0; start < supported.length; start += 10) {
        const batchPhotos = supported.slice(start, start + 10);
        const files: File[] = [];
        for (const photo of batchPhotos) {
          if (photo.size && Number(photo.size) > 15 * 1024 * 1024) {
            throw new Error(`${photo.name} is larger than 15 MB.`);
          }
          const blob = await downloadDriveFileBlob(token, photo.id);
          if (blob.size > 15 * 1024 * 1024) {
            throw new Error(`${photo.name} is larger than 15 MB.`);
          }
          files.push(new File([blob], photo.name, { type: photo.mimeType }));
        }
        await uploadPortfolioImages({
          adminToken,
          postId,
          files,
          makeCover: makeCover && uploadedCount === 0,
        });
        uploadedCount += files.length;
        setMessage(`Imported ${uploadedCount} of ${supported.length} Drive photos…`);
      }
      setMessage(`${uploadedCount} Drive photo(s) imported.`);
      await load();
    } catch (error: any) {
      setMessage(error?.message || 'Could not import photos from Google Drive.');
      throw error;
    } finally {
      setLoading(false);
    }
  }

  function handleDriveFolderSelection(selection: DriveFolderSelectionResult) {
    setDrivePickerOpen(false);
    if (drivePickerTargetPostId) {
      void importDrivePhotos(selection.previewPhotos, driveAccessToken, drivePickerTargetPostId, false)
        .catch(() => undefined);
    } else {
      setSelectedDrivePhotos(selection.previewPhotos);
      setMessage(`${selection.previewPhotos.length} Drive photo(s) selected. They will be copied when you save the post.`);
    }
  }

  async function addImages(postId: string, files: FileList | null) {
    if (!files?.length) return;
    setLoading(true);
    setMessage('');
    try {
      await uploadPortfolioImages({
        adminToken,
        postId,
        files: Array.from(files),
        makeCover: false,
      });
      setMessage('Photos uploaded.');
      await load();
    } catch (error: any) {
      setMessage(error?.message || 'Could not upload photos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Portfolio / Blog Upload</div>
          <h2 className="mt-1 text-2xl font-semibold">Portfolio Management</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
            Create stories, upload photos, choose a cover, publish or unpublish, and mark selected work as Featured for the public Portfolio page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-3.5 py-2 text-sm font-bold"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={newPost}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" /> New Post
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-stone-50 p-4">
          <div className="text-xs uppercase tracking-wider text-stone-400">All posts</div>
          <div className="mt-1 text-2xl font-semibold">{posts.length}</div>
        </div>
        <div className="rounded-2xl bg-stone-50 p-4">
          <div className="text-xs uppercase tracking-wider text-stone-400">Published</div>
          <div className="mt-1 text-2xl font-semibold">{publishedCount}</div>
        </div>
        <div className="rounded-2xl bg-stone-50 p-4">
          <div className="text-xs uppercase tracking-wider text-stone-400">Featured in Portfolio</div>
          <div className="mt-1 text-2xl font-semibold">{featuredCount}</div>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-xl bg-stone-50 p-3 text-sm font-medium text-stone-700">{message}</div>
      )}

      {editorOpen && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{draft.id ? 'Edit Portfolio Post' : 'Create Portfolio Post'}</h3>
            <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg p-2 hover:bg-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Post / Story Title</span>
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 outline-none focus:border-stone-950"
                placeholder="e.g. Anika & Farhan Wedding Story"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Event Type</span>
              <select
                value={draft.event_type}
                onChange={(e) => setDraft((d) => ({ ...d, event_type: e.target.value }))}
                className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3"
              >
                {EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>

            <label className="block lg:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold">Caption / Story</span>
              <textarea
                value={draft.story}
                onChange={(e) => setDraft((d) => ({ ...d, story: e.target.value }))}
                rows={5}
                className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 outline-none focus:border-stone-950"
                placeholder="Write the story, context or caption for this wedding/event..."
              />
            </label>

            <div className="lg:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold">Add Portfolio Photos</span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold">
                  <Upload className="h-4 w-4" /> Choose from device
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    multiple
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => openDrivePicker()}
                  className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white"
                >
                  <FolderOpen className="h-4 w-4" /> Browse / Paste Drive link
                </button>
                <span className="text-xs text-stone-500">
                  {selectedFiles.length} device photo(s) · {selectedDrivePhotos.length} Drive photo(s) selected
                </span>
              </div>
              <p className="mt-2 text-xs text-stone-500">
                Drive photos are copied into public portfolio storage when saved. Supported: JPEG, PNG, WebP and AVIF, up to 15 MB each.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={draft.is_featured}
                onChange={(e) => setDraft((d) => ({ ...d, is_featured: e.target.checked }))}
              />
              ⭐ Featured / Favorite
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={draft.is_published}
                onChange={(e) => setDraft((d) => ({ ...d, is_published: e.target.checked }))}
              />
              Publish now
            </label>
          </div>

          <button
            type="button"
            onClick={savePost}
            disabled={loading}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-stone-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {draft.id ? 'Save Changes' : 'Create Post'}
          </button>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {posts.length === 0 && !loading && (
          <div className="rounded-2xl bg-stone-50 p-8 text-center text-sm text-stone-500">
            No portfolio posts yet. Create your first wedding or event story.
          </div>
        )}

        {posts.map((post) => (
          <article key={post.id} className="rounded-2xl border border-stone-200 p-4">
            <div className="grid gap-5 lg:grid-cols-[180px_1fr_auto]">
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-stone-100">
                {post.cover_image_url ? (
                  <img src={post.cover_image_url} alt={post.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-stone-400"><ImagePlus className="h-8 w-8" /></div>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold">{post.event_type}</span>
                  {post.is_featured && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">⭐ Featured</span>}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${post.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}>
                    {post.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-semibold">{post.title}</h3>
                {post.story && <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-500">{post.story}</p>}
                <div className="mt-3 text-xs text-stone-400">{post.portfolio_media?.length || 0} photo(s)</div>
              </div>

              <div className="flex flex-wrap content-start gap-2 lg:max-w-[210px] lg:justify-end">
                <button type="button" onClick={() => patchPost(post, { is_featured: !post.is_featured })} className="inline-flex items-center gap-1 rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold">
                  <Star className={`h-4 w-4 ${post.is_featured ? 'fill-amber-400 text-amber-500' : ''}`} />
                  {post.is_featured ? 'Unfeature' : 'Feature'}
                </button>
                <button type="button" onClick={() => patchPost(post, { is_published: !post.is_published })} className="inline-flex items-center gap-1 rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold">
                  {post.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {post.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button type="button" onClick={() => editPost(post)} className="inline-flex items-center gap-1 rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold">
                  <Edit3 className="h-4 w-4" /> Edit
                </button>
                <button type="button" onClick={() => deletePost(post)} className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Photos</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => openDrivePicker(post.id)} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold">
                  <FolderOpen className="h-4 w-4" /> Browse / Paste Drive link
                </button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-stone-950 px-3 py-2 text-xs font-bold text-white">
                  <Upload className="h-4 w-4" /> Add Photos
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void addImages(post.id, e.target.files);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            {(post.portfolio_media || []).length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
                {(post.portfolio_media || []).map((media) => (
                  <div key={media.id} className="group relative overflow-hidden rounded-xl bg-stone-100">
                    <div className="aspect-square">
                      <img src={media.image_url} alt={media.alt_text || post.title} className="h-full w-full object-cover" />
                    </div>
                    {media.is_cover && (
                      <div className="absolute left-2 top-2 rounded-full bg-amber-300 px-2 py-1 text-[10px] font-bold text-stone-950">COVER</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/65 p-1.5 opacity-0 transition group-hover:opacity-100">
                      {!media.is_cover && (
                        <button type="button" onClick={() => setCover(post.id, media.id)} className="flex-1 rounded bg-white px-2 py-1 text-[10px] font-bold text-stone-950">Set Cover</button>
                      )}
                      <button type="button" onClick={() => deleteMedia(media.id)} className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
      <DriveFolderPickerModal
        accessToken={driveAccessToken}
        isOpen={drivePickerOpen}
        onClose={() => setDrivePickerOpen(false)}
        onSelectFolder={handleDriveFolderSelection}
        modalTitle="Add Photos from Google Drive"
        confirmButtonLabel="Use These Photos"
      />
    </section>
  );
}
