import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  LineChart,
} from "recharts";

export function MyStatsScreen() {
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState<"3months" | "6months" | "year">("6months");

  // 월별 나눔 데이터
  const monthlyData = [
    { month: "1월", myDonations: 2, average: 1.5 },
    { month: "2월", myDonations: 3, average: 2.0 },
    { month: "3월", myDonations: 1, average: 1.8 },
    { month: "4월", myDonations: 4, average: 2.2 },
    { month: "5월", myDonations: 2, average: 2.5 },
    { month: "6월", myDonations: 5, average: 2.8 },
  ];

  const yearlyData = [
    { month: "1월", myDonations: 2, average: 1.5 },
    { month: "2월", myDonations: 3, average: 2.0 },
    { month: "3월", myDonations: 1, average: 1.8 },
    { month: "4월", myDonations: 4, average: 2.2 },
    { month: "5월", myDonations: 2, average: 2.5 },
    { month: "6월", myDonations: 5, average: 2.8 },
    { month: "7월", myDonations: 3, average: 2.3 },
    { month: "8월", myDonations: 6, average: 3.0 },
    { month: "9월", myDonations: 4, average: 2.7 },
    { month: "10월", myDonations: 5, average: 3.2 },
    { month: "11월", myDonations: 7, average: 3.5 },
    { month: "12월", myDonations: 8, average: 4.0 },
  ];

  const threeMonthsData = monthlyData.slice(-3);

  const getData = () => {
    switch (selectedPeriod) {
      case "3months":
        return threeMonthsData;
      case "6months":
        return monthlyData;
      case "year":
        return yearlyData;
      default:
        return monthlyData;
    }
  };

  const currentData = getData();
  const totalMyDonations = currentData.reduce((sum, item) => sum + item.myDonations, 0);
  const averageMyDonations = (totalMyDonations / currentData.length).toFixed(1);
  const totalAverage = currentData.reduce((sum, item) => sum + item.average, 0);
  const overallAverage = (totalAverage / currentData.length).toFixed(1);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => navigate("/mypage")} className="mr-3">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">나눔통계</h1>
      </div>

      <div className="p-4">
        {/* Period Selection */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setSelectedPeriod("3months")}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              selectedPeriod === "3months"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-200"
            }`}
          >
            3개월
          </button>
          <button
            onClick={() => setSelectedPeriod("6months")}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              selectedPeriod === "6months"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-200"
            }`}
          >
            6개월
          </button>
          <button
            onClick={() => setSelectedPeriod("year")}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              selectedPeriod === "year"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-200"
            }`}
          >
            1년
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600 mb-1">내 나눔 평균</div>
            <div className="text-2xl font-bold text-blue-600">
              {averageMyDonations}회
            </div>
            <div className="text-xs text-gray-500 mt-1">월평균</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600 mb-1">전체 평균</div>
            <div className="text-2xl font-bold text-orange-600">
              {overallAverage}회
            </div>
            <div className="text-xs text-gray-500 mt-1">월평균</div>
          </div>
        </div>

        {/* Comparison Card */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90 mb-1">평균 대비</div>
              <div className="text-2xl font-bold">
                {parseFloat(averageMyDonations) > parseFloat(overallAverage) ? "+" : ""}
                {(parseFloat(averageMyDonations) - parseFloat(overallAverage)).toFixed(1)}회
              </div>
            </div>
            <TrendingUp className="w-12 h-12 opacity-80" />
          </div>
          <div className="text-sm opacity-90 mt-2">
            {parseFloat(averageMyDonations) > parseFloat(overallAverage)
              ? "평균보다 더 많이 나눔하고 계세요! 👏"
              : "조금만 더 힘내세요! 💪"}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
          <h2 className="font-semibold mb-4">월별 나눔 통계</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={currentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="myDonations" fill="#2563eb" name="내 나눔" />
              <Bar dataKey="average" fill="#f97316" name="평균" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Line Chart */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold mb-4">추세 비교</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={currentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="myDonations"
                stroke="#2563eb"
                strokeWidth={2}
                name="내 나눔"
              />
              <Line
                type="monotone"
                dataKey="average"
                stroke="#f97316"
                strokeWidth={2}
                name="평균"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stats Details */}
        <div className="bg-white rounded-lg p-4 shadow-sm mt-6">
          <h2 className="font-semibold mb-4">상세 통계</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">총 나눔 횟수</span>
              <span className="font-semibold text-blue-600">{totalMyDonations}회</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">가장 많이 나눈 달</span>
              <span className="font-semibold">
                {currentData.reduce((max, item) =>
                  item.myDonations > max.myDonations ? item : max
                ).month}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">나눔 참여율</span>
              <span className="font-semibold text-green-600">
                {((parseFloat(averageMyDonations) / parseFloat(overallAverage)) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}