import * as React from "react";
import { format, setMonth, setYear, getMonth, getYear, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { formatDateString, parseDateString } from "@/lib/date";
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
  maxDate?: Date;
  /** Seçili güne yeniden tıklamak tarihi temizlemez (zorunlu alanlar). */
  required?: boolean;
  /** Varsayılan tetikleyici buton yerine kendi tetikleyicin (ör. kompakt dönem etiketi). */
  trigger?: React.ReactNode;
  /** Varsayılan butona geçer — `<Label htmlFor>` eşleşmesi için; `trigger` verilince yoksayılır. */
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

const TRIGGER_CLASS = cn(
  "h-9 w-full justify-between text-left text-sm font-normal",
  "border-input hover:border-primary/50 hover:bg-accent/30",
  "focus-visible:ring-offset-0 aria-invalid:focus-visible:ring-destructive",
  "transition-all duration-200"
);
const POPOVER_CONTENT_CLASS =
  "pointer-events-auto w-auto rounded-md border-input bg-popover shadow-popover";
const LIST_TRIGGER_CLASS = cn(
  "rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-200",
  "hover:bg-primary/10 hover:text-primary data-[state=open]:bg-primary/10 data-[state=open]:text-primary",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
);
const LIST_CONTENT_CLASS = "pointer-events-auto relative w-auto rounded-md border-input p-2";
const LIST_OPTION_CLASS = cn(
  "rounded-lg px-2 py-2 text-xs font-medium transition-all duration-150 hover:bg-primary/15 hover:text-primary",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
);

const START_YEAR = 1940;
const END_YEAR = 2050;
const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);

/** Açılışta seçili seçeneğe odaklan ve listeyi ona kaydır (sayfayı kaydırmadan). */
function focusSelectedOption(event: Event, container: HTMLElement | null, selector: string) {
  const option = container?.querySelector<HTMLElement>(selector);
  if (!container || !option) return;
  event.preventDefault();
  option.focus({ preventScroll: true });
  // Radix yükseklik sınırını (available-height) konumlandırmadan sonra uygular; kaydırmayı ona göre yap.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      container.scrollTop = option.offsetTop - (container.clientHeight - option.offsetHeight) / 2;
    })
  );
}

/** Ay/yıl ızgarasında ok tuşlarıyla gezinme. */
function handleGridKeyDown(event: React.KeyboardEvent<HTMLElement>, columns: number) {
  const steps: Record<string, number | undefined> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -columns,
    ArrowDown: columns,
  };
  const step = steps[event.key];
  if (step === undefined) return;
  const options = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button"));
  const next = options[options.findIndex((option) => option === document.activeElement) + step];
  if (!next) return;
  event.preventDefault();
  next.focus();
  next.scrollIntoView({ block: "nearest" });
}

function MonthYearSelector({
  currentMonth,
  onMonthChange,
}: {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}) {
  const [openList, setOpenList] = React.useState<"month" | "year" | null>(null);
  const monthListRef = React.useRef<HTMLDivElement>(null);
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

  const handleMonthSelect = (monthIndex: number) => {
    onMonthChange(setMonth(currentMonth, monthIndex));
    setOpenList(null);
  };

  const handleYearSelect = (year: number) => {
    onMonthChange(setYear(currentMonth, year));
    setOpenList(null);
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
        aria-label="Önceki ay"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-accent/80 hover:text-foreground "
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1">
        <Popover open={openList === "month"} onOpenChange={(open) => setOpenList(open ? "month" : null)}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`Ay: ${monthNamesLong[selectedMonth]}`} className={LIST_TRIGGER_CLASS}>
              {monthNamesLong[selectedMonth]}
            </button>
          </PopoverTrigger>
          <PopoverContent
            ref={monthListRef}
            align="center"
            sideOffset={8}
            collisionPadding={8}
            aria-label="Ay seç"
            className={LIST_CONTENT_CLASS}
            onOpenAutoFocus={(event) =>
              focusSelectedOption(event, monthListRef.current, `[data-month="${selectedMonth}"]`)
            }
          >
            <div className="grid min-w-[200px] grid-cols-3 gap-1" onKeyDown={(event) => handleGridKeyDown(event, 3)}>
              {monthNamesShort.map((month, index) => (
                <button
                  type="button"
                  key={month}
                  data-month={index}
                  aria-label={monthNamesLong[index]}
                  aria-pressed={selectedMonth === index}
                  onClick={() => handleMonthSelect(index)}
                  className={cn(
                    LIST_OPTION_CLASS,
                    selectedMonth === index ? "bg-primary text-primary-foreground " : "text-foreground/80"
                  )}
                >
                  {month.slice(0, 3)}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={openList === "year"} onOpenChange={(open) => setOpenList(open ? "year" : null)}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`Yıl: ${selectedYear}`} className={LIST_TRIGGER_CLASS}>
              {selectedYear}
            </button>
          </PopoverTrigger>
          <PopoverContent
            ref={yearListRef}
            align="center"
            sideOffset={8}
            collisionPadding={8}
            aria-label="Yıl seç"
            className={cn(LIST_CONTENT_CLASS, "max-h-[min(240px,var(--radix-popover-content-available-height))]")}
            onOpenAutoFocus={(event) =>
              focusSelectedOption(event, yearListRef.current, `[data-year="${selectedYear}"]`)
            }
          >
            <div className="grid min-w-[180px] grid-cols-4 gap-1" onKeyDown={(event) => handleGridKeyDown(event, 4)}>
              {YEARS.map((year) => (
                <button
                  type="button"
                  key={year}
                  data-year={year}
                  aria-pressed={selectedYear === year}
                  onClick={() => handleYearSelect(year)}
                  className={cn(
                    LIST_OPTION_CLASS,
                    selectedYear === year ? "bg-primary text-primary-foreground " : "text-foreground/80"
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <button
        type="button"
        onClick={handleNextMonth}
        aria-label="Sonraki ay"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-accent/80 hover:text-foreground "
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
          month_caption: "hidden",
          caption_label: "hidden",
          nav: "hidden",
          month_grid: "w-full border-collapse",
          weekdays: "flex w-full mb-1",
          weekday: cn(
            "text-muted-foreground font-medium text-[11px] ",
            "h-8 w-10 flex items-center justify-center"
          ),
          week: "flex w-full",
          day: cn(
            "relative p-0.5 text-center text-sm focus-within:relative focus-within:z-20",
            "h-10 w-10 flex items-center justify-center",
            "[&:has([aria-selected])]:bg-transparent"
          ),
          day_button: cn(
            "h-9 w-9 p-0 font-medium rounded-sm",
            "inline-flex items-center justify-center",
            "transition-all duration-200 ease-out",
            "hover:bg-primary/10 hover:text-primary ",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1",
            "aria-selected:opacity-100"
          ),
          selected: cn(
            "bg-primary",
            "text-primary-foreground font-semibold",
            " rounded-sm",
            "  hover:text-primary-foreground ",
            " focus:text-primary-foreground"
          ),
          today: cn(
            "relative font-semibold text-primary",
            "before:absolute before:inset-0 before:rounded-sm before:border-2 before:border-primary/40 before:pointer-events-none",
            ""
          ),
          outside: cn(
            "text-muted-foreground/40 opacity-60",
            "hover:bg-muted/50 hover:text-muted-foreground/60",
            "aria-selected:bg-accent/30 aria-selected:text-muted-foreground/50"
          ),
          disabled:
            "text-muted-foreground/30 opacity-40 cursor-not-allowed hover:bg-transparent ",
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
  maxDate,
  required,
  trigger,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps) {
  const isButtonDisabled = typeof disabled === "boolean" ? disabled : false;
  const userDisabled = typeof disabled === "function" ? disabled : undefined;
  const minTime = minDate ? startOfDay(minDate).getTime() : undefined;
  const maxTime = maxDate ? startOfDay(maxDate).getTime() : undefined;

  const calendarDisabled = React.useMemo<((date: Date) => boolean) | undefined>(() => {
    if (minTime === undefined && maxTime === undefined && !userDisabled) return undefined;
    return (d: Date) => {
      const day = startOfDay(d).getTime();
      if (minTime !== undefined && day < minTime) return true;
      if (maxTime !== undefined && day > maxTime) return true;
      if (userDisabled?.(d)) return true;
      return false;
    };
  }, [minTime, maxTime, userDisabled]);

  const [open, setOpen] = React.useState(false);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate && required) {
      setOpen(false);
      return;
    }
    onSelect?.(selectedDate);
    if (selectedDate) setOpen(false);
  };

  return (
    <Popover
      open={isButtonDisabled ? false : open}
      onOpenChange={(nextOpen) => {
        // Özel `trigger` disabled prop'unu almaz; açılmayı burada merkezi olarak engelle.
        if (isButtonDisabled) return;
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={cn(TRIGGER_CLASS, "group", !date && "text-muted-foreground", className)}
            disabled={isButtonDisabled}
          >
            <span className="flex-1 truncate text-left">
              {date ? format(date, "dd MMMM yyyy", { locale: tr }) : placeholder}
            </span>
            <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-80" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className={cn(POPOVER_CONTENT_CLASS, "p-0")}
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

interface DateInputProps
  extends Omit<DatePickerProps, "date" | "onSelect" | "minDate" | "maxDate"> {
  /** Yerel gün, "yyyy-MM-dd" ya da boş. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}

/** `<Input type="date">` yerine geçer: aynı "yyyy-MM-dd" string sözleşmesiyle DatePicker. */
export function DateInput({ value, onChange, min, max, ...props }: DateInputProps) {
  return (
    <DatePicker
      {...props}
      date={parseDateString(value)}
      minDate={parseDateString(min)}
      maxDate={parseDateString(max)}
      onSelect={(d) => onChange(formatDateString(d))}
    />
  );
}

interface MonthPickerProps {
  /** Ayın herhangi bir günü — yalnız ay+yıl kullanılır. */
  date?: Date;
  onSelect: (date: Date) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Gün ızgarası olmadan ay+yıl seçimi — DatePicker'ın ay/yıl başlığını tek başına sunar. */
export function MonthPicker({
  date,
  onSelect,
  placeholder = "Ay seçin",
  className,
  disabled,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [viewMonth, setViewMonth] = React.useState<Date>(date ?? new Date());

  React.useEffect(() => {
    if (date) setViewMonth(date);
  }, [date]);

  return (
    <Popover
      open={disabled ? false : open}
      onOpenChange={(nextOpen) => {
        if (disabled) return;
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={cn(TRIGGER_CLASS, !date && "text-muted-foreground", className)}
        >
          <span className="flex-1 truncate text-left">
            {date ? format(date, "LLLL yyyy", { locale: tr }) : placeholder}
          </span>
          <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(POPOVER_CONTENT_CLASS, "p-2")}
        align="start"
        sideOffset={8}
      >
        <MonthYearSelector
          currentMonth={viewMonth}
          onMonthChange={(nextMonth) => {
            setViewMonth(nextMonth);
            onSelect(nextMonth);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

MonthPicker.displayName = "MonthPicker";
