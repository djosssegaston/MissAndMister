<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TicketOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'event_id',
        'payment_id',
        'holder_name',
        'holder_phone',
        'holder_email',
        'delivery_method',
        'total_amount',
        'currency',
        'status',
        'payment_reference',
        'quantity',
    ];

    protected $casts = [
        'total_amount' => 'integer',
        'quantity' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function payment()
    {
        return $this->belongsTo(Payment::class);
    }

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }

    public function ticketType()
    {
        return $this->hasOneThrough(TicketType::class, Ticket::class, 'ticket_order_id', 'id', 'id', 'ticket_type_id');
    }

    public function isPaid(): bool
    {
        return $this->status === 'paid';
    }
}
