"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface AutoCompleteOption {
  value: string;
  label: string;
  description?: string;
  metadata?: any;
}

interface AutoCompleteProps {
  options: AutoCompleteOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  loading?: boolean;
  onSearch?: (query: string) => void;
  debounceMs?: number;
  maxHeight?: string;
  allowCustomValue?: boolean; // Allow typing custom values not in the list
}

export function AutoComplete({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  emptyMessage = "No results found.",
  searchPlaceholder = "Search...",
  disabled = false,
  className,
  loading = false,
  onSearch,
  debounceMs = 300,
  maxHeight = "300px",
  allowCustomValue = false,
}: AutoCompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const debounceTimerRef = React.useRef<NodeJS.Timeout>();

  // Debounced search handler
  const handleSearch = React.useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (onSearch) {
        // Clear existing timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        // Set new timer
        debounceTimerRef.current = setTimeout(() => {
          onSearch(query);
        }, debounceMs);
      }
    },
    [onSearch, debounceMs]
  );

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Filter options based on search query (client-side filtering)
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;

    const query = searchQuery.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // Get selected option
  const selectedOption = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  allowCustomValue &&
                  searchQuery.trim()
                ) {
                  e.preventDefault();
                  onValueChange?.(searchQuery.trim());
                  setOpen(false);
                  setSearchQuery("");
                }
              }}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList style={{ maxHeight }}>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : filteredOptions.length === 0 ? (
              <CommandEmpty>
                {emptyMessage}
                {allowCustomValue && searchQuery.trim() && (
                  <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                    Press Enter to use "{searchQuery.trim()}"
                  </div>
                )}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredOptions.slice(0, 10).map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={(currentValue) => {
                      onValueChange?.(
                        currentValue === value ? "" : currentValue
                      );
                      setOpen(false);
                      setSearchQuery("");
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      {option.description && (
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
                {filteredOptions.length > 10 && (
                  <div className="py-2 text-center text-xs text-muted-foreground border-t">
                    Showing 10 of {filteredOptions.length} results
                  </div>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
