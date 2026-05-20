import * as React from "react";
import { format, setMonth, setYear, getMonth, getYear, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

interface DatePickerProps {
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean | ((date: Date) => boolean);
  minDate?: Date;
}

const START_YEAR = 1940;
const END_YEAR = 2050;
const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);

function MonthYearSelector({
  currentMonth,
  onMonthChange,
}: {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}) {
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const [showYearPicker, setShowYearPicker] = React.useState(false);
  const monthRef = React.useRef<HTMLDivElement>(null);
  const yearRef = React.useRef<HTMLDivElement>(null);
  const yearListRef = React.useRef<HTMLDivElement>(null);

  const selectedMonth = getMonth(currentMonth);
  const selectedYear = getYear(currentMonth);

  const monthNamesLong = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), "LLLL", { locale: tr })),
    []
  );
  const monthNamesShort = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), "LLL", { locale: tr })),
    []
  );

  React.useEffect(() => {
    if (showYearPicker && yearListRef.current) {
      const selectedButton = yearListRef.current.querySelector(`[data-year="${selectedYear}"]`);
      selectedButton?.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, [showYearPicker, selectedYear]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (monthRef.current && !monthRef.current.contains(event.target as Node)) {
        setShowMonthPicker(false);
      }
      if (yearRef.current && !yearRef.current.contains(event.target as Node)) {
        setShowYearPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMonthSelect = (monthIndex: number) => {
    onMonthChange(setMonth(currentMonth, monthIndex));
    setShowMonthPicker(false);
  };

  const handleYearSelect = (year: number) => {
    onMonthChange(setYear(currentMonth, year));
    setShowYearPicker(false);
  };

  const handlePrevMonth = () => {
    const newMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const newYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    onMonthChange(setMonth(setYear(currentMonth, newYear), newMonth));
  };

  const handleNextMonth = () => {
    const newMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
    const newYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    onMonthChange(setMonth(setYear(currentMonth, newYear), newMonth));
  };

  return (
    <div className="flex items-center justify-between px-1 pb-3 pt-1">
      <button
        type="button"
        onClick={handlePrevMonth}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-accent/80 hover:text-foreground active:scale-95"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1">
        <div className="relative" ref={monthRef}>
          <button
            type="button"
            onClick={() => {
              setShowMonthPicker(!showMonthPicker);
              setShowYearPicker(false);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-200",
              "hover:bg-primary/10 hover:text-primary",
              showMonthPicker && "bg-primary/10 text-primary"
            )}
          >
            {monthNamesLong[selectedMonth]}
          </button>

          {showMonthPicker && (
            <div className="pointer-events-auto absolute left-1/2 top-full z-[9999] mt-2 -translate-x-1/2 duration-200 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
              <div className="grid min-w-[200px] grid-cols-3 gap-1 rounded-xl border border-border/50 bg-popover/95 p-2 shadow-2xl shadow-black/20 backdrop-blur-xl">
                {monthNamesShort.map((month, index) => (
                  <button
                    type="button"
                    key={month}
                    onClick={() => handleMonthSelect(index)}
                    className={cn(
                      "rounded-lg px-2 py-2 text-xs font-medium transition-all duration-150",
                      "hover:scale-105 hover:bg-primary/15 hover:text-primary",
                      selectedMonth === index
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : "text-foreground/80"
                    )}
                  >
                    {month.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={yearRef}>
          <button
            type="button"
            onClick={() => {
              setShowYearPicker(!showYearPicker);
              setShowMonthPicker(false);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-200",
              "hover:bg-primary/10 hover:text-primary",
              showYearPicker && "bg-primary/10 text-primary"
            )}
          >
            {selectedYear}
          </button>

          {showYearPicker && (
            <div className="pointer-events-auto absolute left-1/2 top-full z-[9999] mt-2 -translate-x-1/2 duration-200 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
              <div
                ref={yearListRef}
                className="max-h-[240px] overflow-y-auto rounded-xl border border-border/50 bg-popover/95 p-2 shadow-2xl shadow-black/20 backdrop-blur-xl"
              >
                <div className="grid min-w-[180px] grid-cols-4 gap-1">
                  {YEARS.map((year) => (
                    <button
                      type="button"
                      key={year}
                      data-year={year}
                      onClick={() => handleYearSelect(year)}
                      className={cn(
                        "rounded-lg px-2 py-2 text-xs font-medium transition-all duration-150",
                        "hover:scale-105 hover:bg-primary/15 hover:text-primary",
                        selectedYear === year
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                          : "text-foreground/80"
                      )}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleNextMonth}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-accent/80 hover:text-foreground active:scale-95"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

interface EnhancedCalendarProps {
  className?: string;
  classNames?: CalendarProps["classNames"];
  showOutsideDays?: boolean;
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
}

function EnhancedCalendar({
  className,
  classNames: customClassNames,
  showOutsideDays = true,
  selected,
  onSelect,
  disabled,
}: EnhancedCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    selected instanceof Date ? selected : new Date()
  );

  return (
    <div className={cn("p-3", className)}>
      <MonthYearSelector currentMonth={currentMonth} onMonthChange={setCurrentMonth} />

      <DayPicker
        mode="single"
        showOutsideDays={showOutsideDays}
        className="pointer-events-auto"
        weekStartsOn={1}
        locale={tr}
        month={currentMonth}
        onMonthChange={setCurrentMonth}
        selected={selected}
        onSelect={onSelect}
        disabled={disabled}
        classNames={{
          months: "flex flex-col",
          month: "space-y-2",
          caption: "hidden",
          caption_label: "hidden",
          nav: "hidden",
          month_grid: "w-full border-collapse",
          weekdays: "flex w-full mb-1",
          weekday: cn(
            "text-muted-foreground/70 font-medium text-[11px] uppercase tracking-wider",
            "h-8 w-10 flex items-center justify-center"
          ),
          week: "flex w-full",
          day: cn(
            "relative p-0.5 text-center text-sm focus-within:relative focus-within:z-20",
            "h-10 w-10 flex items-center justify-center",
            "[&:has([aria-selected])]:bg-transparent"
          ),
          day_button: cn(
            "h-9 w-9 p-0 font-medium rounded-full",
            "inline-flex items-center justify-center",
            "transition-all duration-200 ease-out",
            "hover:bg-primary/10 hover:text-primary hover:scale-110",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1",
            "aria-selected:opacity-100"
          ),
          selected: cn(
            "bg-gradient-to-br from-primary to-primary/80",
            "text-primary-foreground font-semibold",
            "shadow-lg shadow-primary/25 rounded-full",
            "hover:from-primary hover:to-primary/90 hover:text-primary-foreground hover:scale-110",
            "focus:from-primary focus:to-primary/90 focus:text-primary-foreground"
          ),
          today: cn(
            "relative font-semibold text-primary",
            "before:absolute before:inset-0 before:rounded-full before:border-2 before:border-primary/40 before:pointer-events-none",
            "before:animate-pulse"
          ),
          outside: cn(
            "text-muted-foreground/40 opacity-60",
            "hover:bg-muted/50 hover:text-muted-foreground/60",
            "aria-selected:bg-accent/30 aria-selected:text-muted-foreground/50"
          ),
          disabled:
            "text-muted-foreground/30 opacity-40 cursor-not-allowed hover:bg-transparent hover:scale-100",
          hidden: "invisible",
          ...customClassNames,
        }}
      />
    </div>
  );
}

export function DatePicker({
  date,
  onSelect,
  placeholder = "Tarih seçin",
  className,
  disabled,
  minDate,
}: DatePickerProps) {
  const isButtonDisabled = typeof disabled === "boolean" ? disabled : false;
  const userDisabled = typeof disabled === "function" ? disabled : undefined;
  const minTime = minDate ? startOfDay(minDate).getTime() : undefined;

  const calendarDisabled = React.useMemo<((date: Date) => boolean) | undefined>(() => {
    if (minTime === undefined && !userDisabled) return undefined;
    return (d: Date) => {
      if (minTime !== undefined && startOfDay(d).getTime() < minTime) return true;
      if (userDisabled?.(d)) return true;
      return false;
    };
  }, [minTime, userDisabled]);

  const [open, setOpen] = React.useState(false);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    onSelect?.(selectedDate);
    if (selectedDate) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-8 w-full justify-between text-left text-xs font-normal",
            "border-border/50 hover:border-primary/50 hover:bg-accent/30",
            "transition-all duration-200",
            "group",
            !date && "text-muted-foreground",
            className
          )}
          disabled={isButtonDisabled}
        >
          <span className="flex-1 truncate text-left">
            {date ? format(date, "dd MMMM yyyy", { locale: tr }) : placeholder}
          </span>
          <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-80" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-auto p-0",
          "bg-popover/95 backdrop-blur-xl",
          "border-border/50",
          "shadow-2xl shadow-black/20",
          "pointer-events-auto z-[9999]",
          "rounded-xl"
        )}
        align="start"
        sideOffset={8}
      >
        <EnhancedCalendar
          selected={date}
          onSelect={handleDateSelect}
          disabled={calendarDisabled}
        />
      </PopoverContent>
    </Popover>
  );
}

DatePicker.displayName = "DatePicker";
