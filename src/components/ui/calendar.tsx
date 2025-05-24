import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format, getMonth, getYear, setMonth, setYear } from "date-fns"
import { enUS } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = false,
  ...props
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(props.defaultMonth || new Date());
  const [currentYear, setCurrentYear] = React.useState<number>(currentMonth.getFullYear());
  
  // Generate years for dropdown (from 1900 to current year + 10)
  const thisYear = new Date().getFullYear();
  const years = Array.from(
    { length: thisYear - 1900 + 11 },
    (_, i) => 1900 + i
  );
  
  // Months for dropdown
  const months = [
    "January", "February", "March", "April", 
    "May", "June", "July", "August", 
    "September", "October", "November", "December"
  ];
  
  // Handle year change
  const handleYearChange = (year: string) => {
    const newYear = parseInt(year);
    setCurrentYear(newYear);
    
    const newDate = new Date(currentMonth);
    newDate.setFullYear(newYear);
    setCurrentMonth(newDate);
    
    if (props.onMonthChange) {
      props.onMonthChange(newDate);
    }
  };
  
  // Handle month change
  const handleMonthChange = (month: string) => {
    const monthIndex = months.findIndex(m => m === month);
    if (monthIndex !== -1) {
      const newDate = new Date(currentMonth);
      newDate.setMonth(monthIndex);
      setCurrentMonth(newDate);
      
      if (props.onMonthChange) {
        props.onMonthChange(newDate);
      }
    }
  };
  
  // Update current month when month changes
  React.useEffect(() => {
    if (props.month) {
      setCurrentMonth(props.month);
      setCurrentYear(props.month.getFullYear());
    }
  }, [props.month]);
  
  return (
    <div className="rdp-wrapper bg-white rounded-lg shadow-md border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4 space-x-2">
        <Select 
          value={months[getMonth(currentMonth)]} 
          onValueChange={handleMonthChange}
        >
          <SelectTrigger className="w-[110px] h-9 bg-white border border-gray-200 text-sm">
            <SelectValue placeholder={months[getMonth(currentMonth)]} />
          </SelectTrigger>
          <SelectContent className="max-h-[15rem] bg-white">
            {months.map((month) => (
              <SelectItem key={month} value={month} className="text-sm">
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select 
          value={currentYear.toString()} 
          onValueChange={handleYearChange}
        >
          <SelectTrigger className="w-[80px] h-9 bg-white border border-gray-200 text-sm">
            <SelectValue placeholder={currentYear.toString()} />
          </SelectTrigger>
          <SelectContent className="max-h-[15rem] bg-white">
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()} className="text-sm">
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn("p-0", className)}
        locale={enUS}
        month={currentMonth}
        onMonthChange={setCurrentMonth}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-2",
          caption: "hidden", // Hide the default caption
          nav: "flex items-center justify-between px-1 py-1",
          nav_button: cn(
            buttonVariants({ variant: "outline" }),
            "h-8 w-8 bg-white border border-gray-200 p-0 hover:bg-gray-100 flex items-center justify-center"
          ),
          nav_button_previous: "ml-1",
          nav_button_next: "mr-1",
          table: "w-full border-collapse",
          head_row: "flex w-full",
          head_cell: "text-muted-foreground rounded-md w-10 h-10 font-medium text-[0.8rem] flex items-center justify-center",
          row: "flex w-full mt-0",
          cell: "relative w-10 h-10 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
          day: cn(
            buttonVariants({ variant: "ghost" }),
            "h-10 w-10 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100"
          ),
          day_range_end: "day-range-end",
          day_selected:
            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          day_today: "bg-accent text-accent-foreground border border-primary",
          day_outside:
            "day-outside text-muted-foreground opacity-50", // Show outside days with reduced opacity
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle:
            "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
          ...classNames,
        }}
        {...props}
      />
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar } 