import { useState, useRef } from "react";
import { Upload, Download, CheckCircle, AlertCircle, RefreshCw, MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SF_STATIONS } from "@/lib/sfStations";
import { SF_LOCKERS } from "@/lib/sfLockers";

interface ParsedStation {
  code: string;
  name: string;
  district: string;
  address: string;
  region: string;
  type: "station" | "locker";
}

interface ParseResult {
  stations: ParsedStation[];
  errors: string[];
}

function parseCSV(content: string): ParseResult {
  const lines = content.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const errors: string[] = [];
  const stations: ParsedStation[] = [];

  if (lines.length === 0) {
    errors.push("CSV 文件為空");
    return { stations, errors };
  }

  // Detect header line
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes("code") || firstLine.includes("name") || firstLine.includes("district");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  dataLines.forEach((line, idx) => {
    const lineNum = hasHeader ? idx + 2 : idx + 1;
    // Support comma and tab separators
    const parts = line.includes("\t") ? line.split("\t") : line.split(",").map(p => p.replace(/^"|"$/g, "").trim());

    if (parts.length < 4) {
      errors.push(`第 ${lineNum} 行：欄位不足（需要 code, name, district, address, region）`);
      return;
    }

    const [code, name, district, address, region = ""] = parts;

    if (!code || !name || !district || !address) {
      errors.push(`第 ${lineNum} 行：必填欄位缺失`);
      return;
    }

    const type: "station" | "locker" = code.startsWith("H") ? "locker" : "station";
    stations.push({ code: code.trim(), name: name.trim(), district: district.trim(), address: address.trim(), region: region.trim() || "香港", type });
  });

  return { stations, errors };
}

function generateCSVTemplate(type: "stations" | "lockers"): string {
  const header = "code,name,district,address,region\n";
  if (type === "stations") {
    const sample = SF_STATIONS.slice(0, 5).map(s => `${s.code},${s.name},${s.district},"${s.address}",${s.region}`).join("\n");
    return header + sample;
  } else {
    const sample = SF_LOCKERS.slice(0, 5).map(s => `${s.code},${s.name},${s.district},"${s.address}",${s.region}`).join("\n");
    return header + sample;
  }
}

export function AdminSFStationUpdate() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      toast.error("請上傳 CSV 或 TXT 格式的文件");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = parseCSV(content);
      setParseResult(result);
      if (result.errors.length === 0) {
        toast.success(`成功解析 ${result.stations.length} 個站點`);
      } else {
        toast.warning(`解析完成，${result.stations.length} 個站點，${result.errors.length} 個錯誤`);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleApplyUpdate = () => {
    if (!parseResult || parseResult.stations.length === 0) return;

    // Generate new TypeScript content
    const stationLines = parseResult.stations
      .filter(s => s.type === "station")
      .map(s => `  { code: "${s.code}", name: "${s.name}", district: "${s.district}", address: "${s.address}", region: "${s.region}" }`)
      .join(",\n");

    const lockerLines = parseResult.stations
      .filter(s => s.type === "locker")
      .map(s => `  { code: "${s.code}", name: "${s.name}", district: "${s.district}", address: "${s.address}", region: "${s.region}" }`)
      .join(",\n");

    const stationCount = parseResult.stations.filter(s => s.type === "station").length;
    const lockerCount = parseResult.stations.filter(s => s.type === "locker").length;

    // Download as TypeScript files for developer to apply
    if (stationCount > 0) {
      const tsContent = `// Auto-generated SF Express Hong Kong Station Data\n// Updated: ${new Date().toISOString().split("T")[0]}\n// Total: ${stationCount} stations\nexport interface SFStation {\n  code: string;\n  name: string;\n  district: string;\n  address: string;\n  region: string;\n}\nexport const SF_STATIONS: SFStation[] = \n[\n${stationLines}\n];\n`;
      const blob = new Blob([tsContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sfStations.ts";
      a.click();
      URL.revokeObjectURL(url);
    }

    if (lockerCount > 0) {
      const tsContent = `// Auto-generated SF Express Hong Kong Locker Data\n// Updated: ${new Date().toISOString().split("T")[0]}\n// Total: ${lockerCount} lockers\nexport interface SFLocker {\n  code: string;\n  name: string;\n  district: string;\n  address: string;\n  region: string;\n}\nexport const SF_LOCKERS: SFLocker[] = \n[\n${lockerLines}\n];\n`;
      const blob = new Blob([tsContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sfLockers.ts";
      a.click();
      URL.revokeObjectURL(url);
    }

    toast.success(`已生成 TypeScript 文件，請將文件替換到 client/src/lib/ 目錄`);
  };

  const downloadTemplate = (type: "stations" | "lockers") => {
    const content = generateCSVTemplate(type);
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = type === "stations" ? "sf_stations_template.csv" : "sf_lockers_template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("模板已下載");
  };

  const stationCount = parseResult?.stations.filter(s => s.type === "station").length ?? 0;
  const lockerCount = parseResult?.stations.filter(s => s.type === "locker").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-slate-900 font-bold text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#FEDD00]" />
            順豐站點資料管理
          </h3>
          <p className="text-slate-500 text-sm mt-1">上傳 CSV 文件更新順豐站和智能櫃列表</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="border-slate-300 text-slate-400 hover:text-slate-900 hover:border-gray-400" onClick={() => downloadTemplate("stations")}>
            <Download className="w-4 h-4 mr-1.5" />順豐站模板
          </Button>
          <Button variant="outline" size="sm" className="border-slate-300 text-slate-400 hover:text-slate-900 hover:border-gray-400" onClick={() => downloadTemplate("lockers")}>
            <Download className="w-4 h-4 mr-1.5" />智能櫃模板
          </Button>
        </div>
      </div>

      {/* Current Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-500 text-xs">現有順豐站</p>
              <p className="text-slate-900 font-bold text-xl">{SF_STATIONS.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-slate-500 text-xs">現有智能櫃</p>
              <p className="text-slate-900 font-bold text-xl">{SF_LOCKERS.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Format Guide */}
      <div className="bg-[#1a1a2e] rounded-xl p-4 border border-slate-200">
        <p className="text-slate-400 text-sm font-medium mb-2">CSV 格式說明</p>
        <div className="bg-slate-100 rounded-lg p-3 font-mono text-xs text-green-400">
          <p>code,name,district,address,region</p>
          <p className="text-slate-400"># 順豐站（code 格式：852XXX）</p>
          <p>852FTL,順豐站 上水,上水,"香港新界北區上水彩園路...",新界</p>
          <p className="text-slate-400"># 智能櫃（code 格式：H852XXXXP）</p>
          <p>H852001P,順豐智能櫃 中環,中環,"香港中環...",香港島</p>
        </div>
        <p className="text-slate-400 text-xs mt-2">系統自動根據 code 前綴區分順豐站（852）和智能櫃（H852）</p>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          isDragging ? "border-[#FEDD00] bg-[#FEDD00]/5" : "border-slate-300 hover:border-gray-400"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">拖放 CSV 文件到此處，或點擊選擇文件</p>
        <p className="text-slate-400 text-sm mt-1">支援 .csv 和 .txt 格式，UTF-8 編碼</p>
        {fileName && <p className="text-[#FEDD00] text-sm mt-2 font-medium">已選擇：{fileName}</p>}
      </div>

      {/* Parse Results */}
      {parseResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-[#1a1a2e] rounded-xl p-3 border border-slate-200 text-center">
              <p className="text-slate-500 text-xs">總站點數</p>
              <p className="text-slate-900 font-bold text-xl sm:text-2xl">{parseResult.stations.length}</p>
            </div>
            <div className="bg-[#1a1a2e] rounded-xl p-3 border border-blue-700/50 text-center">
              <p className="text-blue-400 text-xs">順豐站</p>
              <p className="text-slate-900 font-bold text-xl sm:text-2xl">{stationCount}</p>
            </div>
            <div className="bg-[#1a1a2e] rounded-xl p-3 border border-amber-700/50 text-center">
              <p className="text-amber-400 text-xs">智能櫃</p>
              <p className="text-slate-900 font-bold text-xl sm:text-2xl">{lockerCount}</p>
            </div>
          </div>

          {/* Errors */}
          {parseResult.errors.length > 0 && (
            <div className="bg-red-50 border border-red-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-red-400 font-medium text-sm">{parseResult.errors.length} 個解析錯誤</p>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {parseResult.errors.map((err, i) => (
                  <p key={i} className="text-red-300 text-xs font-mono">{err}</p>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {parseResult.stations.length > 0 && (
            <div className="bg-[#1a1a2e] rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <p className="text-slate-400 text-sm font-medium">預覽（前 10 筆）</p>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-xs">{parseResult.stations.length} 筆資料就緒</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-left text-slate-500">類型</th>
                      <th className="px-3 py-2 text-left text-slate-500">編號</th>
                      <th className="px-3 py-2 text-left text-slate-500">名稱</th>
                      <th className="px-3 py-2 text-left text-slate-500">地區</th>
                      <th className="px-3 py-2 text-left text-slate-500">地址</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.stations.slice(0, 10).map((s, i) => (
                      <tr key={i} className="border-b border-slate-200 hover:bg-white/5">
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            s.type === "locker" ? "bg-amber-900/40 text-amber-300" : "bg-blue-900/40 text-blue-300"
                          }`}>
                            {s.type === "locker" ? "智能櫃" : "順豐站"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-400">{s.code}</td>
                        <td className="px-3 py-2 text-slate-400">{s.name}</td>
                        <td className="px-3 py-2 text-slate-500">{s.district}</td>
                        <td className="px-3 py-2 text-slate-400 max-w-[200px] truncate">{s.address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Button */}
          {parseResult.stations.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-amber-300 font-medium text-sm">更新說明</p>
                  <p className="text-amber-400/80 text-xs mt-1">
                    點擊「生成 TypeScript 文件」後，系統會下載新的 <code className="bg-slate-100 px-1 rounded">sfStations.ts</code> 和/或 <code className="bg-slate-100 px-1 rounded">sfLockers.ts</code> 文件。
                    請將文件替換到 <code className="bg-slate-100 px-1 rounded">client/src/lib/</code> 目錄並重新部署，即可更新站點資料。
                  </p>
                </div>
              </div>
              <Button
                className="w-full mt-3 font-bold"
                style={{ backgroundColor: "#FEDD00", color: "#06038D" }}
                onClick={handleApplyUpdate}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                生成 TypeScript 文件（{parseResult.stations.length} 個站點）
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
