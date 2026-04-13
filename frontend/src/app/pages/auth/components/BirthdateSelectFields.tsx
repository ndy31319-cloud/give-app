interface BirthdateSelectFieldsProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  hasError?: boolean;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 100 }, (_, index) => String(currentYear - index));
const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const days = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0"));

const splitBirthdate = (value: string) => {
  const [year = "", month = "", day = ""] = value.split("-");
  return { year, month, day };
};

export function BirthdateSelectFields({
  value,
  onChange,
  onBlur,
  hasError = false,
}: BirthdateSelectFieldsProps) {
  const { year, month, day } = splitBirthdate(value);

  const updateBirthdate = (nextYear = year, nextMonth = month, nextDay = day) => {
    if (!nextYear && !nextMonth && !nextDay) {
      onChange("");
      return;
    }

    onChange([nextYear, nextMonth, nextDay].join("-"));
  };

  const selectClassName = `h-11 rounded-md border px-3 text-sm bg-white ${
    hasError ? "border-red-500" : "border-gray-300"
  }`;

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        value={year}
        onChange={(e) => updateBirthdate(e.target.value, month, day)}
        onBlur={onBlur}
        className={selectClassName}
      >
        <option value="">년</option>
        {years.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <select
        value={month}
        onChange={(e) => updateBirthdate(year, e.target.value, day)}
        onBlur={onBlur}
        className={selectClassName}
      >
        <option value="">월</option>
        {months.map((item) => (
          <option key={item} value={item}>
            {Number(item)}
          </option>
        ))}
      </select>

      <select
        value={day}
        onChange={(e) => updateBirthdate(year, month, e.target.value)}
        onBlur={onBlur}
        className={selectClassName}
      >
        <option value="">일</option>
        {days.map((item) => (
          <option key={item} value={item}>
            {Number(item)}
          </option>
        ))}
      </select>
    </div>
  );
}
