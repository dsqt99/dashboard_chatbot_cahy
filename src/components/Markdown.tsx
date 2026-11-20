import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
      }}>{text}</ReactMarkdown>
    </div>
  )
}
