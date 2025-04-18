
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Mon', present: 45, late: 4, absent: 1 },
  { name: 'Tue', present: 47, late: 2, absent: 1 },
  { name: 'Wed', present: 44, late: 5, absent: 1 },
  { name: 'Thu', present: 48, late: 1, absent: 1 },
  { name: 'Fri', present: 46, late: 3, absent: 1 },
];

const AttendanceChart = () => {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="present" stackId="1" stroke="#22c55e" fill="#22c55e" />
          <Area type="monotone" dataKey="late" stackId="1" stroke="#f59e0b" fill="#f59e0b" />
          <Area type="monotone" dataKey="absent" stackId="1" stroke="#ef4444" fill="#ef4444" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AttendanceChart;
