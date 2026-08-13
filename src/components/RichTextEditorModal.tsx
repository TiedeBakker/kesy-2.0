// kesy-2.0/src/components/RichTextEditorModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { 
  Bold, Italic, List, ListOrdered, Heading1, Heading2, 
  Quote, ImageIcon, X, Save, AlignLeft, AlignRight, AlignCenter, Maximize2 
} from 'lucide-react';

// Custom Image Extension om layout-metadata (zoals kolom-span/uitlijning) op te slaan
const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-layout': {
        default: 'inline-center',
        parseHTML: element => element.getAttribute('data-layout'),
        renderHTML: attributes => {
          if (!attributes['data-layout']) return {};
          return { 'data-layout': attributes['data-layout'] };
        },
      },
    };
  },
});

interface RichTextEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue: string; // De bestaande HTML/JSON uit SQLite
  title?: string;
  onSave: (htmlContent: string) => void; // Aangeroepen bij opslaan
}

export const RichTextEditorModal: React.FC<RichTextEditorModalProps> = ({
  isOpen,
  onClose,
  initialValue,
  title = 'Tekst en Illustraties Bewerken',
  onSave,
}) => {
  const [imageUrl, setImageUrl] = useState('');
  const [imageLayout, setImageLayout] = useState<'inline-left' | 'inline-right' | 'inline-center' | 'span-all'>('inline-center');
  const [showImageDialog, setShowImageDialog] = useState(false);


  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      CustomImage.configure({
        inline: false,
        allowBase64: true,
      }),
    ],
    content: initialValue || '<p></p>',
    editorProps: {
      attributes: {
        // Tailwind resets opvangen met expliciete element styling
        class: [
          'focus:outline-none min-h-[250px] p-4 text-slate-100',
          '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-sky-400 [&_h1]:mb-3 [&_h1]:mt-4',
          '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-sky-300 [&_h2]:mb-2 [&_h2]:mt-3',
          '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ul]:space-y-1',
          '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_ol]:space-y-1',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-sky-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-3 [&_blockquote]:text-slate-300',
          '[&_p]:mb-2',
        ].join(' '),
      },
    },
  });

  // Synchroniseer de editor als de initialValue of isOpen verandert
  useEffect(() => {
    if (editor && isOpen) {
      editor.commands.setContent(initialValue || '<p></p>');
    }
  }, [initialValue, isOpen, editor]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (editor) {
      const html = editor.getHTML();
      onSave(html);
      onClose();
    }
  };

  const addImage = () => {
    if (imageUrl && editor) {
      editor.chain().focus().setImage({ 
        src: imageUrl, 
        // @ts-ignore custom attribute
        'data-layout': imageLayout 
      }).run();

      setImageUrl('');
      setShowImageDialog(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        {editor && (
          <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-950 border-b border-slate-800 text-slate-300">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-2 rounded hover:bg-slate-800 ${editor.isActive('bold') ? 'bg-slate-800 text-sky-400' : ''}`}
              title="Vetgedrukt"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-2 rounded hover:bg-slate-800 ${editor.isActive('italic') ? 'bg-slate-800 text-sky-400' : ''}`}
              title="Cursief"
            >
              <Italic className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-slate-800 mx-1" />

            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-2 rounded hover:bg-slate-800 ${editor.isActive('heading', { level: 1 }) ? 'bg-slate-800 text-sky-400' : ''}`}
              title="Kop 1"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-2 rounded hover:bg-slate-800 ${editor.isActive('heading', { level: 2 }) ? 'bg-slate-800 text-sky-400' : ''}`}
              title="Kop 2"
            >
              <Heading2 className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-slate-800 mx-1" />

            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-2 rounded hover:bg-slate-800 ${editor.isActive('bulletList') ? 'bg-slate-800 text-sky-400' : ''}`}
              title="Opsomming"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-2 rounded hover:bg-slate-800 ${editor.isActive('orderedList') ? 'bg-slate-800 text-sky-400' : ''}`}
              title="Genummerde lijst"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`p-2 rounded hover:bg-slate-800 ${editor.isActive('blockquote') ? 'bg-slate-800 text-sky-400' : ''}`}
              title="Citaat"
            >
              <Quote className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-slate-800 mx-1" />

            {/* Afbeelding toevoegen knop */}
            <button
              onClick={() => setShowImageDialog(!showImageDialog)}
              className="p-2 rounded hover:bg-slate-800 text-slate-300 flex items-center gap-1.5 text-xs font-medium bg-slate-900 border border-slate-700"
              title="Afbeelding/Illustratie invoegen"
            >
              <ImageIcon className="w-4 h-4 text-sky-400" />
              <span>Afbeelding Invoegen</span>
            </button>
          </div>
        )}

        {/* Popover/Dialog voor Afbeeldingen */}
        {showImageDialog && (
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col gap-3">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Afbeelding Invoegen & Layout instellen</div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Afbeelding URL (https://... of data:image/...)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
              />
              <select
                value={imageLayout}
                onChange={(e: any) => setImageLayout(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
              >
                <option value="inline-left">1 Kolom (Links uitgelijnd)</option>
                <option value="inline-center">1 Kolom (Gecentreerd)</option>
                <option value="inline-right">1 Kolom (Rechts uitgelijnd)</option>
                <option value="span-all">2 Kolommen Breed (Volle pagina)</option>
              </select>
              <button
                onClick={addImage}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Invoegen
              </button>
            </div>
          </div>
        )}

        {/* Editor gebied */}
        <div className="flex-1 overflow-y-auto bg-slate-900/50">
          <EditorContent editor={editor} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium shadow-md transition-colors"
          >
            <Save className="w-4 h-4" />
             Opslaan naar database
          </button>
        </div>

      </div>
    </div>
  );
};