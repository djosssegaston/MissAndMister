<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Event extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'title',
        'description',
        'location',
        'event_date',
        'image_path',
        'status',
        'created_by',
    ];

    protected $casts = [
        'event_date' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $event): void {
            if (blank($event->uuid)) {
                $event->uuid = Str::uuid()->toString();
            }
            if (blank($event->status)) {
                $event->status = 'draft';
            }
        });
    }

    public function ticketTypes()
    {
        return $this->hasMany(TicketType::class);
    }

    public function orders()
    {
        return $this->hasMany(TicketOrder::class);
    }

    public function creator()
    {
        return $this->belongsTo(Admin::class, 'created_by');
    }

    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? asset('storage/'.$this->image_path) : null;
    }

    public function getAvailableQuantity(): int
    {
        return $this->ticketTypes->sum(fn ($type) => max(0, $type->quantity_total - $type->quantity_sold));
    }

    public function getTotalRevenue(): int
    {
        return $this->orders()
            ->where('status', 'paid')
            ->sum('total_amount');
    }

    public function getTotalSold(): int
    {
        return $this->ticketTypes->sum('quantity_sold');
    }
}
