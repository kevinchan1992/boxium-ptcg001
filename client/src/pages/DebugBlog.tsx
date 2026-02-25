import { trpc } from "@/lib/trpc";

export default function DebugBlog() {
  const { data: post, isLoading, error } = trpc.blog.debugGetPost.useQuery({});

  if (isLoading) return <div className="p-8">載入中...</div>;
  if (error) return <div className="p-8 text-red-500">錯誤: {error.message}</div>;
  if (!post) return <div className="p-8">沒有找到文章</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">文章數據調試</h1>
      
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <strong className="text-lg">ID:</strong> {post.id}
        </div>
        <div>
          <strong className="text-lg">標題:</strong> {post.title}
        </div>
        <div>
          <strong className="text-lg">狀態:</strong> {post.status}
        </div>
        <div>
          <strong className="text-lg">主題圖片:</strong>
          <div className="mt-2">
            {post.featuredImage ? (
              <>
                <div className="text-green-600 font-semibold mb-2">✅ 有圖片 URL</div>
                <div className="bg-gray-100 p-3 rounded text-sm break-all">
                  {post.featuredImage}
                </div>
                <div className="mt-4">
                  <img 
                    src={post.featuredImage} 
                    alt={post.title}
                    className="max-w-full h-auto border-2 border-gray-300 rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const errorDiv = document.createElement('div');
                      errorDiv.className = 'text-red-500 font-semibold mt-2';
                      errorDiv.textContent = '❌ 圖片載入失敗';
                      (e.target as HTMLImageElement).parentElement?.appendChild(errorDiv);
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="text-red-600 font-semibold">❌ 無圖片 URL（null 或空字符串）</div>
            )}
          </div>
        </div>
        <div>
          <strong className="text-lg">創建時間:</strong> {new Date(post.createdAt).toLocaleString('zh-TW')}
        </div>
      </div>
    </div>
  );
}
