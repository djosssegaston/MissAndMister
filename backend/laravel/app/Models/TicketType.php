<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TicketType extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'name',
        'description',
        'image_path',
        'ticket_template_path',
        'price',
        'currency',
        'quantity_total',
        'quantity_sold',
    ];

    protected $casts = [
        'price' => 'integer',
        'quantity_total' => 'integer',
        'quantity_sold' => 'integer',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }

    public function getAvailableQuantity(): int
    {
        return max(0, $this->quantity_total - $this->quantity_sold);
    }

    public function isSoldOut(): bool
    {
        return $this->getAvailableQuantity() <= 0;
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? asset('storage/'.$this->image_path) : null;
    }
}
